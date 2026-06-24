# Date Consistency Audit — Backend Specification

## Problem Statement

The backend registers the server execution timestamp (`datetime.now()` at processing time) as `transaction_date` instead of the actual transaction date contained in the email body or email metadata. This causes incorrect financial reports, wrong period filtering in dashboards, and data untrustworthiness.

## Scope

Three backend modules + one new script:

| Module | File | Change Scope |
|---|---|---|
| Email Parser | `backend/app/services/email_parser.py` | Timezone normalization, new patterns, UTC output |
| Processing Router | `backend/app/routers/email_processing.py` | Content-hash dedup, aware datetime validation |
| Schemas | `backend/app/models/schemas.py` | `transaction_date` type change to aware datetime |
| Migration Script | `backend/scripts/migrate_dates.py` | **New** — correct historical records |
| Tests | `backend/tests/test_date_extraction.py` | **New** — 10 test cases |

---

## Phase 1 — Diagnosis & Extraction (Data Mapping)

### 1.1 Normalize Timezone to UTC

Colombia operates at UTC-5 with no DST. Email body dates are in local Bogotá time. Email `Date:` headers carry explicit RFC 2822 timezone offsets.

**Rule**:
- Body dates (regex-parsed, naive) → assume `America/Bogota` → convert to UTC
- Header dates (RFC 2822, may have offset) → parse offset → convert to UTC
- If offset cannot be determined → log warning, assume UTC-5

**Implementation** — new function in `email_parser.py`:

```python
from zoneinfo import ZoneInfo
from datetime import datetime, timezone, timedelta

BOGOTA_TZ = ZoneInfo("America/Bogota")

def normalize_to_utc(dt: datetime, source_tz: tzinfo | None = None) -> datetime:
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc)
    tz = source_tz or BOGOTA_TZ
    return dt.replace(tzinfo=tz).astimezone(timezone.utc)
```

### 1.2 Reinforce Pattern Coverage

Add `DD-MM-YYYY` (hyphen-separated) variants to `DATE_PATTERNS`:

```
(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})
(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2})
(\d{2}-\d{2}-\d{4})
```

### 1.3 Audit Existing Parser

Run `POST /api/email/test-parse` against a battery of 20 real Bancolombia emails. Record for each:
- Input body snippet (first 200 chars)
- Expected date
- Returned date
- Parse method used (regex / header / now)

Document any remaining failures as new patterns to add.

---

## Phase 2 — Backend Refactor (Persistence)

### 2.1 UTC Throughout the Pipeline

| Layer | Change |
|---|---|
| `parse_email_static()` return value | `transaction_date` is `datetime` with `tzinfo=timezone.utc` |
| `EmailParseResult.transaction_date` | Type stays `datetime` (no change needed) |
| `email_processing.py` insert | `.isoformat()` on an aware datetime produces `2024-04-15T19:30:00+00:00` |
| `TransactionCreate.transaction_date` | Keep `datetime`, add `Field(validate_default=True)` — runtime ensures aware |

### 2.2 Content-Hash Idempotency

Add a `content_hash` column to the `transactions` table (SHA-256 hex string). This is a second layer of defense beyond `processed_emails.email_message_id`.

**Hash components** (joined with `|`):
- `amount` (stringified decimal, normalized to 2 decimals)
- `description` (lowercase, stripped)
- `transaction_date` (ISO 8601 UTC)

**Insert flow** (in `email_processing.py`, before line 139):
1. Compute `content_hash = sha256(f"{amount}|{desc}|{date_iso}".encode()).hexdigest()`
2. Check `supabase.table("transactions").select("id").eq("content_hash", content_hash).execute()`
3. If exists → raise HTTP 409 (duplicate detected by content)
4. Else → include `content_hash` in insert payload

**Supabase side**: Add unique index on `content_hash`:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_content_hash
ON transactions (content_hash) WHERE content_hash IS NOT NULL;
```

### 2.3 Database Constraints

Pre-migration step: detect duplicate `email_message_id` values in `processed_emails` before applying the constraint. If duplicates exist, keep the most recent row (by `id`) and delete older duplicates.

```sql
-- Detect duplicates first
SELECT email_message_id, COUNT(*) FROM processed_emails
GROUP BY email_message_id HAVING COUNT(*) > 1;

-- Remove older duplicates (keeping the row with the smallest id)
DELETE FROM processed_emails
WHERE id NOT IN (
    SELECT MIN(id) FROM processed_emails GROUP BY email_message_id
);

-- Then add the constraint
ALTER TABLE processed_emails ADD CONSTRAINT
uq_processed_emails_message_id UNIQUE (email_message_id);
```

---

## Phase 3 — QA & Historical Data

### 3.1 Historical Migration Script

`backend/scripts/migrate_dates.py` — standalone script (not a router).

**Algorithm**:
1. Fetch all transactions where `DATE(transaction_date) = DATE(created_at)` (heuristic: likely wrong).
2. For each, re-parse `raw_email_content` with `parse_email_static()`.
3. If a different date is extracted, `UPDATE` the row with the corrected UTC date.
4. If `raw_email_content` is empty or parsing fails, log the row ID for manual review.
5. Dry-run mode (`--dry-run`) that only prints what would change.

```python
# Usage
python -m backend.scripts.migrate_dates          # apply changes
python -m backend.scripts.migrate_dates --dry-run  # preview only
```

### 3.2 Test Cases

File: `backend/tests/test_date_extraction.py`

| ID | Scenario | Input Date Text | Email Header | Expected UTC | Notes |
|---|---|---|---|---|---|
| TC1 | Standard DD/MM/YYYY with seconds | `"15/04/2024 14:30:00"` | — | `2024-04-15T19:30:00Z` | Most common Bancolombia format |
| TC2 | Without seconds | `"15/04/2024 14:30"` | — | `2024-04-15T19:30:00Z` | Common variant |
| TC3 | Spanish month name | `"15 de abril de 2024"` | — | `2024-04-15T05:00:00Z` | Midnight assumed |
| TC4 | ISO format | `"2024-04-15 14:30:00"` | — | `2024-04-15T19:30:00Z` | Backward compat |
| TC5 | Header date fallback | `"Tu transferencia..."` | `"Mon, 15 Apr 2024 14:30:00 -0500"` | `2024-04-15T19:30:00Z` | Body has no date |
| TC6 | No date anywhere | `"Sin fecha visible"` | `""` | `now() UTC ± 5s` | Last resort — tolerance window prevents test flakiness |
| TC7 | Single-digit day/month | `"5/4/2024 14:30:00"` | — | `2024-04-05T19:30:00Z` | Lax format |
| TC8 | Duplicate by Message-ID | Same email twice | — | HTTP 409 | Existing dedup |
| TC9 | Duplicate by content hash | Same amount+desc+date, different msg ID | — | HTTP 409 | New dedup |
| TC10 | DD-MM-YYYY (hyphens) | `"15-04-2024"` | — | `2024-04-15T05:00:00Z` | New pattern |

### 3.3 Load Test

File: `backend/tests/test_date_extraction.py` (same file as unit tests, as a separate test class or marker).

The test:
1. Generates 100 synthetic Bancolombia-like emails (varying amounts, dates, descriptions).
2. Sends each through the processing pipeline via `parse_email_static()` directly.
3. Verifies no duplicates, no `created_at == transaction_date` mismatches.
4. Measures total wall time (< 30s for 100 = 300ms per email, acceptable).

Run with:
```bash
cd backend && python -m pytest tests/test_date_extraction.py::LoadTests -v
```

### 3.4 Monitoring (Post-Deploy)

Add structured log line in `parse_email_static()` on every successful parse:

```python
logger.info(
    "date_extraction",
    extra={
        "method": date_method,       # "regex" | "header" | "now"
        "original": raw_date_str,
        "normalized": dt.isoformat(),
        "timezone_assumed": "America/Bogota" if naive else dt.tzinfo.key,
    }
)
```

---

## File Change Summary

| File | Action | Key Changes |
|---|---|---|
| `backend/app/services/email_parser.py` | Modify | Add `normalize_to_utc()`, hyphen patterns, UTC output |
| `backend/app/routers/email_processing.py` | Modify | Content-hash dedup, aware datetime validation |
| `backend/app/models/schemas.py` | Modify | `transaction_date` field validation for timezone awareness |
| `backend/scripts/migrate_dates.py` | **Create** | Historical data correction |
| `backend/tests/test_date_extraction.py` | **Create** | 10 test cases covering all date sources |
| `backend/app/services/email_fetcher.py` | None | Already extracts Date header |
| Supabase (direct SQL) | Run | Add unique index on `content_hash`, unique constraint on `processed_emails.email_message_id` |

---

## Out of Scope

- LLM-based date extraction (static regex + header is sufficient; LLM is a fallback when confidence < 0.6, not a primary date source)
- Frontend changes (the frontend already consumes `transaction_date` from the API correctly)
- Removing `processed_emails` table (content hash is additive, not a replacement)
- Timezone display in frontend (dates are always UTC, frontend should format client-side if needed)
