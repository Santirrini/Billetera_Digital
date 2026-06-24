"""
Apply database constraints for content_hash and processed_emails dedup.
Tries SQL via direct connection if available, otherwise prints commands.

Usage:
    python -m backend.scripts.apply_constraints
"""

import sys
from app.config import get_settings


SQL_COMMANDS = [
    "-- 1. Add content_hash column",
    "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS content_hash TEXT;",
    "",
    "-- 2. Unique index on content_hash (non-null only)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_content_hash "
    "ON transactions (content_hash) WHERE content_hash IS NOT NULL;",
    "",
    "-- 3. Deduplicate processed_emails (keep row with smallest id)",
    "DELETE FROM processed_emails "
    "WHERE id NOT IN (SELECT MIN(id) FROM processed_emails GROUP BY email_message_id);",
    "",
    "-- 4. Add unique constraint on email_message_id",
    "ALTER TABLE processed_emails ADD CONSTRAINT "
    "uq_processed_emails_message_id UNIQUE (email_message_id);",
]


def main():
    settings = get_settings()

    # Try direct PostgreSQL connection if a DB password is configured
    db_password = getattr(settings, "supabase_db_password", None)
    if db_password:
        try:
            import psycopg2
            project_ref = settings.supabase_url.split("//")[1].split(".")[0]
            conn = psycopg2.connect(
                host=f"db.{project_ref}.supabase.co",
                port=5432,
                dbname="postgres",
                user="postgres",
                password=db_password,
                sslmode="require",
            )
            conn.autocommit = True
            cur = conn.cursor()
            for cmd in SQL_COMMANDS:
                if cmd.strip() and not cmd.startswith("--"):
                    cur.execute(cmd)
                    print(f"[OK] {cmd[:80]}...")
            cur.close()
            conn.close()
            print("\nAll constraints applied successfully.")
            return
        except Exception as e:
            print(f"[WARN] Direct connection failed: {e}")
            print("Falling back to SQL output.\n")

    # Print SQL for manual execution in Supabase SQL Editor
    print("=" * 60)
    print("Run these SQL commands in your Supabase SQL Editor:")
    print("=" * 60)
    for cmd in SQL_COMMANDS:
        print(cmd)
    print("=" * 60)


if __name__ == "__main__":
    main()
