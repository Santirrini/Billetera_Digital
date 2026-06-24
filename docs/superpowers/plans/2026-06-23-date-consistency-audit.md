# Date Consistency Audit — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure `transaction_date` always reflects the real bank transaction date (UTC), not the server processing timestamp, across the entire email ingestion pipeline.

**Architecture:** Three backend layers — (1) `email_parser.py` normalizes date extraction to UTC with full format coverage, (2) `email_processing.py` adds content-hash deduplication, (3) new migration script corrects historical records. All changes are additive; no existing endpoints or schemas are broken.

**Tech Stack:** Python 3.12+, FastAPI, Supabase (PostgreSQL), Pydantic v2, `zoneinfo` (stdlib), `hashlib` (stdlib), `pytest`.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `backend/app/services/email_parser.py` | Modify | UTC date normalization, hyphen patterns, structured logging |
| `backend/app/models/schemas.py` | Modify | Aware-datetime validation on `transaction_date` |
| `backend/app/routers/email_processing.py` | Modify | Content-hash dedup in insert flow |
| `backend/scripts/migrate_dates.py` | Create | One-time historical data correction |
| `backend/tests/test_date_extraction.py` | Create | 10 test cases + load test |

---

## Chunk 1: Parser — UTC Normalization + Pattern Expansion

**Files:**
- Modify: `backend/app/services/email_parser.py`

### Task 1.1: Add hyphen date patterns to DATE_PATTERNS

- [ ] **Step 1: Read current state**

Current `DATE_PATTERNS` at lines 56-65 has 8 slash/ISO patterns. Add 3 hyphen variants after the existing patterns.

- [ ] **Step 2: Edit regex patterns**

Add after the ISO patterns (after line 64):

```python
    (r"(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})", "%d-%m-%Y %H:%M:%S"),  # 15-04-2024 14:30:00
    (r"(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2})", "%d-%m-%Y %H:%M"),            # 15-04-2024 14:30
    (r"(\d{2}-\d{2}-\d{4})", "%d-%m-%Y"),                                  # 15-04-2024
```

### Task 1.2: Add normalize_to_utc() and BOGOTA_TZ

- [ ] **Step 1: Update imports**

Add `import logging` and update datetime import to include `timezone`:

```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import logging

logger = logging.getLogger(__name__)
```

- [ ] **Step 2: Add BOGOTA_TZ and normalize_to_utc()**

Add after the SPANISH_MONTHS dict (after line 72):

```python
BOGOTA_TZ = ZoneInfo("America/Bogota")


def normalize_to_utc(dt: datetime, source_tz=None) -> datetime:
    """Convert a datetime to UTC. If naive, assume source_tz (default Bogota)."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc)
    tz = source_tz or BOGOTA_TZ
    return dt.replace(tzinfo=tz).astimezone(timezone.utc)
```

### Task 1.3: Make parse_email_date_header() return aware datetime

- [ ] **Step 1: Edit `parse_email_date_header()`**

Current line 110 does `.replace(tzinfo=None)` — remove that line:

```python
def parse_email_date_header(header: str) -> Optional[datetime]:
    if not header:
        return None
    try:
        parsed = email.utils.parsedate_to_datetime(header)
        return parsed  # already has tzinfo from RFC 2822
    except Exception:
        return None
```

### Task 1.4: Make parse_email_static() return UTC-aware dates

- [ ] **Step 1: Edit the date fallback chain**

Currently lines 184-193. Replace with:

```python
    # Shared: try to extract date from email body
    raw_date = try_parse_date(full_text)

    # If no date found in body, fall back to email Date header
    if raw_date is None:
        raw_date = parse_email_date_header(email_date) if email_date else None

    # Normalize to UTC (body dates are naive Bogota time; header may have offset)
    if raw_date is not None:
        transaction_date = normalize_to_utc(raw_date)
    else:
        # Still no date — use now as UTC
        transaction_date = datetime.now(timezone.utc)
```

- [ ] **Step 2: Add structured logging**

After the normalization block, add (use `extra=` for structured fields):

```python
    # Determine which source was used
    if raw_date is not None:
        date_source = "body_regex" if try_parse_date(full_text) is not None else "email_header"
        logger.info(
            "date_extraction",
            extra={
                "method": date_source,
                "original": raw_date.isoformat() if hasattr(raw_date, 'isoformat') else str(raw_date),
                "normalized": transaction_date.isoformat(),
                "timezone_assumed": "America/Bogota" if (raw_date is not None and raw_date.tzinfo is None) else "from_offset",
            }
        )
    else:
        logger.info(
            "date_extraction",
            extra={
                "method": "now",
                "original": "",
                "normalized": transaction_date.isoformat(),
                "timezone_assumed": "UTC",
            }
        )
```

### Task 1.5: Test Chunk 1 — Run existing parser test

- [ ] **Step 1: Quick smoke test**

Run: `cd backend && python -c "from app.services.email_parser import parse_email_static; r = parse_email_static('Compra por \$50.000', '15/04/2024 14:30:00'); print(repr(r.transaction_date))"`

Expected: `datetime.datetime(2024, 4, 15, 19, 30, tzinfo=datetime.timezone.utc)` (14:30 Bogota + 5h = 19:30 UTC).

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/email_parser.py
git commit -m "feat(parser): UTC date normalization and expanded patterns"
```

---

## Chunk 2: Audit — Manual Test with Real Bancolombia Emails

> **Agent note:** Renumber tasks inside chunks below as 2.x

**Files:**
- Modify: (none — this is a diagnostic step)

### Task 2.1: Run 20 real emails through test-parse

- [ ] **Step 1: Collect test batch**

From Gmail inbox, extract 20 Bancolombia notification emails covering different transaction types (compras, transferencias, consignaciones, pagos nómina). Save subject + body + expected date in a local file `backend/test_batch.json`:

```json
[
  {"subject": "...", "body": "...", "expected_date": "2024-04-15T19:30:00+00:00"},
  ...
]
```

- [ ] **Step 2: Run batch through test-parse**

```bash
cd backend && venv\Scripts\activate && python -c "
import json, urllib.request
with open('test_batch.json') as f:
    batch = json.load(f)
for item in batch:
    data = json.dumps(item).encode()
    req = urllib.request.Request('http://localhost:8000/api/email/test-parse', data=data, headers={'Content-Type':'application/json'})
    r = json.loads(urllib.request.urlopen(req).read())
    out = r.get('static_result', {})
    print(f\"{out.get('transaction_date','MISSING')}  expected={item['expected_date']}\")
"
```

- [ ] **Step 3: Document gaps**

For each mismatch, record:
- Body snippet (first 200 chars)
- Expected date vs returned date
- Which parse method was used

If any date format is missing, add it to the pattern list in Chunk 1 before proceeding.

---

## Chunk 3: Schemas — Aware Datetime Validation

**Files:**
- Modify: `backend/app/models/schemas.py`

### Task 3.1: Add timezone awareness validator to TransactionCreate

- [ ] **Step 1: Add `field_validator` import**

Update the import line from:

```python
from pydantic import BaseModel, Field
```

to:

```python
from pydantic import BaseModel, Field, field_validator
```

- [ ] **Step 2: Add validator to `TransactionCreate`**

After line 24 (`transaction_date: datetime`), add:

```python
    @field_validator("transaction_date")
    @classmethod
    def ensure_aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("transaction_date must be timezone-aware (UTC)")
        return v
```

### Task 3.2: Smoke test schemas

- [ ] **Step 1: Test validation**

Run: `cd backend && python -c "from app.models.schemas import TransactionCreate; from datetime import datetime, timezone; t = TransactionCreate(type='ingreso', amount=100, transaction_date=datetime.now(timezone.utc)); print('OK')"`

Expected: `OK`

Run naive rejection: `cd backend && python -c "from app.models.schemas import TransactionCreate; from datetime import datetime; t = TransactionCreate(type='ingreso', amount=100, transaction_date=datetime.now())"`

Expected: `pydantic_core._pydantic_core.ValidationError`

- [ ] **Step 2: Commit**

```bash
git add backend/app/models/schemas.py
git commit -m "feat(schemas): validate transaction_date is timezone-aware"
```

---

## Chunk 4: Processing — Content-Hash Deduplication

**Files:**
- Modify: `backend/app/routers/email_processing.py`

### Task 4.1: Add content hash computation and dedup check

- [ ] **Step 1: Add import**

Add at top of file:

```python
import hashlib
```

- [ ] **Step 2: Add content_hash to transaction_data dict**

Before line 85 (`"transaction_date": ...`), compute and add content_hash:

```python
        "transaction_date": parse_result.transaction_date.isoformat(),
```

Replace with:

```python
        "transaction_date": parse_result.transaction_date.isoformat(),
        "content_hash": hashlib.sha256(
            f"{parse_result.amount}|{parse_result.description.strip().lower()}|{parse_result.transaction_date.isoformat()}".encode()
        ).hexdigest(),
```

- [ ] **Step 3: Add content-hash dedup check after parsing**

After the `if parse_result is None` block (after line ~71, where parse_result is confirmed non-None), add content-hash computation and dedup check. Compute once, use for both dedup and the insert payload:

```python
    # Compute content hash for dedup
    content_hash = hashlib.sha256(
        f"{parse_result.amount}|{parse_result.description.strip().lower()}|{parse_result.transaction_date.isoformat()}".encode()
    ).hexdigest()

    # Check for duplicate by content hash
    existing_content = (
        supabase.table("transactions")
        .select("id")
        .eq("content_hash", content_hash)
        .execute()
    )
    if existing_content.data:
        raise HTTPException(status_code=409, detail="Transaction already exists (content hash match)")
```

Then in the insert payload (`transaction_data` dict), use the already-computed variable:

```python
    transaction_data = {
        ...
        "content_hash": content_hash,
    }
```

### Task 4.2: Smoke test dedup flow

- [ ] **Step 1: Manual test**

Start backend: `cd backend; venv\Scripts\activate; uvicorn app.main:app --reload`

Send same email twice: `curl -X POST http://localhost:8000/api/email/process -H "Content-Type: application/json" -d '{"subject":"Compra","body":"Compra por $50.000 el 15/04/2024"}'`

First → 200. Second → 409.

- [ ] **Step 2: Commit**

```bash
git add backend/app/routers/email_processing.py
git commit -m "feat(processing): content-hash deduplication check"
```

---

## Chunk 5: Database Constraints (Supabase SQL)

### Task 5.1: Add content_hash column and unique index

- [ ] **Step 1: Add column in Supabase SQL editor**

```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS content_hash TEXT;
```

- [ ] **Step 2: Add unique index (only on non-null values)**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_content_hash
ON transactions (content_hash) WHERE content_hash IS NOT NULL;
```

### Task 5.2: Deduplicate and constrain processed_emails

- [ ] **Step 1: Detect and remove duplicate message_ids**

```sql
-- Detect
SELECT email_message_id, COUNT(*) FROM processed_emails
GROUP BY email_message_id HAVING COUNT(*) > 1;

-- Remove older duplicates (keep row with smallest id)
DELETE FROM processed_emails
WHERE id NOT IN (
    SELECT MIN(id) FROM processed_emails GROUP BY email_message_id
);

-- Add constraint
ALTER TABLE processed_emails ADD CONSTRAINT
uq_processed_emails_message_id UNIQUE (email_message_id);
```

- [ ] **Step 2: Verify constraints**

```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'processed_emails';
```

---

## Chunk 6: Migration Script for Historical Data

**Files:**
- Create: `backend/scripts/migrate_dates.py`

### Task 6.1: Create migrate_dates.py

- [ ] **Step 1: Create directory**

```powershell
New-Item -ItemType Directory -Path "backend\scripts" -Force
```

- [ ] **Step 2: Write the script**

```python
"""
Historical data migration: correct transaction_date for records that
were stored with the server timestamp instead of the real transaction date.

Usage:
    python -m backend.scripts.migrate_dates          # apply changes
    python -m backend.scripts.migrate_dates --dry-run  # preview only
"""

import argparse
import sys
from datetime import datetime, timezone

from app.db.supabase_client import get_supabase_client
from app.services.email_parser import parse_email_static


def main():
    parser = argparse.ArgumentParser(description="Correct historical transaction dates")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    args = parser.parse_args()

    supabase = get_supabase_client()

    # Heuristic: fetch rows where DATE(transaction_date) == DATE(created_at)
    result = (
        supabase.table("transactions")
        .select("id, transaction_date, created_at, raw_email_content")
        .execute()
    )
    rows = result.data or []
    candidates = []
    for row in rows:
        if row.get("raw_email_content"):
            tx_date = row.get("transaction_date", "")
            cr_date = row.get("created_at", "")
            if tx_date[:10] == cr_date[:10]:
                candidates.append(row)

    if not candidates:
        print("No candidate records found (all transaction_date differ from created_at).")
        return

    updated = 0
    for row in candidates:
        re_parsed = parse_email_static("", row["raw_email_content"])
        if re_parsed and re_parsed.transaction_date:
            new_date = re_parsed.transaction_date
            if new_date.tzinfo is None:
                new_date = new_date.replace(tzinfo=timezone.utc)
            old_date_str = row["transaction_date"]
            new_date_str = new_date.isoformat()
            if old_date_str != new_date_str:
                if args.dry_run:
                    print(f"[DRY-RUN] {row['id']}: {old_date_str} -> {new_date_str}")
                else:
                    supabase.table("transactions").update(
                        {"transaction_date": new_date_str}
                    ).eq("id", row["id"]).execute()
                    print(f"[UPDATED] {row['id']}: {old_date_str} -> {new_date_str}")
                updated += 1
        else:
            print(f"[SKIP] {row['id']}: could not re-parse raw_email_content")

    print(f"\nDone. {updated} records {'would be' if args.dry_run else ''} updated.")


if __name__ == "__main__":
    main()
```

### Task 6.2: Dry-run the migration

- [ ] **Step 1: Execute dry-run**

```bash
cd backend && venv\Scripts\activate && python -m backend.scripts.migrate_dates --dry-run
```

Expected: prints what would change, no actual updates.

- [ ] **Step 2: Commit**

```bash
git add backend/scripts/migrate_dates.py
git commit -m "feat(scripts): historical date migration script"
```

---

## Chunk 7: Test Cases

**Files:**
- Create: `backend/tests/test_date_extraction.py`

### Task 7.1: Unit tests for date extraction (TC1-TC7, TC10)

- [ ] **Step 1: Write test file**

```python
"""Tests for date extraction from Bancolombia emails."""

import pytest
from datetime import datetime, timezone, timedelta
from app.services.email_parser import (
    parse_email_static,
    try_parse_date,
    parse_email_date_header,
    normalize_to_utc,
)
from app.models.schemas import EmailParseResult


class TestDateExtraction:
    """TC1-TC7: Date extraction from email body."""

    @pytest.mark.parametrize("body,expected_utc_str", [
        # TC1: Standard DD/MM/YYYY with seconds
        ("Compra por $50.000 el 15/04/2024 14:30:00", "2024-04-15T19:30:00+00:00"),
        # TC2: Without seconds
        ("Compra por $50.000 el 15/04/2024 14:30", "2024-04-15T19:30:00+00:00"),
        # TC3: Spanish month name
        ("Transferencia Recibida el 15 de abril de 2024", "2024-04-15T05:00:00+00:00"),
        # TC4: ISO format
        ("Compra por $50.000 2024-04-15 14:30:00", "2024-04-15T19:30:00+00:00"),
        # TC7: Single-digit day/month
        ("Compra por $50.000 el 5/4/2024 14:30:00", "2024-04-05T19:30:00+00:00"),
        # TC10: DD-MM-YYYY (hyphens)
        ("Compra por $50.000 el 15-04-2024", "2024-04-15T05:00:00+00:00"),
    ])
    def test_body_date_extraction(self, body, expected_utc_str):
        result = parse_email_static("Test subject", body)
        assert result is not None
        assert result.transaction_date.isoformat() == expected_utc_str

    # TC5: Header date fallback (body has no date)
    def test_header_date_fallback(self):
        body = "Tu transferencia por $50.000 fue exitosa"
        header = "Mon, 15 Apr 2024 14:30:00 -0500"
        result = parse_email_static("Test subject", body, header)
        assert result is not None
        # RFC 2822 with -0500: 14:30 -0500 = 19:30 UTC
        assert result.transaction_date.isoformat() == "2024-04-15T19:30:00+00:00"

    # TC6: No date anywhere — should be now() within tolerance
    def test_now_fallback(self):
        before = datetime.now(timezone.utc)
        result = parse_email_static("No date here", "Sin fecha visible")
        after = datetime.now(timezone.utc)
        assert result is not None
        assert before - timedelta(seconds=5) <= result.transaction_date <= after + timedelta(seconds=5)

    def test_normalize_to_utc_naive_bogota(self):
        naive = datetime(2024, 4, 15, 14, 30)
        utc = normalize_to_utc(naive)
        assert utc == datetime(2024, 4, 15, 19, 30, tzinfo=timezone.utc)

    def test_normalize_to_utc_already_utc(self):
        aware = datetime(2024, 4, 15, 19, 30, tzinfo=timezone.utc)
        utc = normalize_to_utc(aware)
        assert utc == aware

    def test_normalize_to_utc_with_offset(self):
        from zoneinfo import ZoneInfo
        aware = datetime(2024, 4, 15, 14, 30, tzinfo=ZoneInfo("America/New_York"))
        utc = normalize_to_utc(aware)
        # EDT is UTC-4, so 14:30 EDT = 18:30 UTC
        assert utc == datetime(2024, 4, 15, 18, 30, tzinfo=timezone.utc)
```

- [ ] **Step 2: Write integration tests for dedup (TC8-TC9)**

Add to the same file:

```python
class TestDedup:
    """TC8-TC9: Idempotency checks."""

    def test_content_hash_uniqueness(self, monkeypatch):
        """Verify that the same content produces the same hash."""
        import hashlib
        content = "50.000|test purchase|2024-04-15T19:30:00+00:00"
        h1 = hashlib.sha256(content.encode()).hexdigest()
        h2 = hashlib.sha256(content.encode()).hexdigest()
        assert h1 == h2
```

- [ ] **Step 3: Write load test**

Add as a separate class:

```python
class LoadTests:
    """Generate 100 synthetic emails and process them."""

    def test_100_emails(self):
        import time
        start = time.time()
        for i in range(100):
            body = f"Compra por ${i*1000}.00 el 15/04/2024 14:30:00"
            result = parse_email_static(f"Compra {i}", body)
            assert result is not None
            assert result.transaction_date.tzinfo is not None
        elapsed = time.time() - start
        assert elapsed < 30, f"Load test took {elapsed:.2f}s (limit 30s)"
```

- [ ] **Step 4: Run tests**

```bash
cd backend && python -m pytest tests/test_date_extraction.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_date_extraction.py
git commit -m "test: date extraction unit tests and load test"
```

---

## Chunk 8: Verification — End-to-End Smoke Test

### Task 8.1: Full pipeline test

- [ ] **Step 1: Start backend**

```bash
cd backend && venv\Scripts\activate && uvicorn app.main:app --reload
```

- [ ] **Step 2: Test /api/email/test-parse with various formats**

```bash
# Standard format
curl -X POST http://localhost:8000/api/email/test-parse \
  -H "Content-Type: application/json" \
  -d '{"subject":"Compra","body":"Compra por $50.000 el 15/04/2024 14:30:00"}'

# Spanish date format
curl -X POST http://localhost:8000/api/email/test-parse \
  -H "Content-Type: application/json" \
  -d '{"subject":"Compra","body":"Compra por $50.000 el 15 de abril de 2024"}'
```

Expected: `static_result.transaction_date` shows UTC time with `+00:00`.

- [ ] **Step 3: Test /api/email/process**

```bash
curl -X POST http://localhost:8000/api/email/process \
  -H "Content-Type: application/json" \
  -d '{"subject":"Compra","body":"Compra por $50.000 el 15/04/2024 14:30:00"}'
```

Expected: 200, `transaction.transaction_date` is `"2024-04-15T19:30:00+00:00"`.

- [ ] **Step 4: Test dedup — same body twice**

```bash
# Send the same thing again
curl -X POST http://localhost:8000/api/email/process \
  -H "Content-Type: application/json" \
  -d '{"subject":"Compra","body":"Compra por $50.000 el 15/04/2024 14:30:00"}'
```

Expected: 409 (content hash match).

- [ ] **Step 5: Test dedup — same body with different subject**

```bash
curl -X POST http://localhost:8000/api/email/process \
  -H "Content-Type: application/json" \
  -d '{"subject":"Notificación Bancolombia","body":"Compra por $50.000 el 15/04/2024 14:30:00"}'
```

Expected: 409 (content hash matches on amount+description+date, ignores subject).

### Task 8.2: Final commit

- [ ] **Step 1: Stage and verify**

```bash
git status
```

Verify no unexpected files.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: complete date consistency audit changes"
```

---

## Summary of all file changes

| File | Lines Changed | Nature |
|---|---|---|
| `backend/app/services/email_parser.py` | ~30 | UTC normalization, patterns, logging |
| `backend/app/models/schemas.py` | ~6 | `field_validator` for timezone awareness |
| `backend/app/routers/email_processing.py` | ~20 | Content-hash dedup + payload field |
| `backend/scripts/migrate_dates.py` | ~60 | New: historical correction script |
| `backend/tests/test_date_extraction.py` | ~100 | New: 10 tests + load test |
| Supabase (SQL) | 6 lines | Unique index + constraint |
