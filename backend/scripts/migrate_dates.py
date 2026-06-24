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
