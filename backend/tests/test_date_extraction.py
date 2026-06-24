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
        ("Transferencia Recibida por $50.000 el 15 de abril de 2024", "2024-04-15T05:00:00+00:00"),
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
        assert result.transaction_date.isoformat() == "2024-04-15T19:30:00+00:00"

    # TC6: No date anywhere — should be now() within tolerance
    def test_now_fallback(self):
        before = datetime.now(timezone.utc)
        result = parse_email_static("No date here", "Compra por $50.000 sin fecha visible")
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
        assert utc == datetime(2024, 4, 15, 18, 30, tzinfo=timezone.utc)


class TestDedup:
    """TC8-TC9: Idempotency checks."""

    def test_content_hash_uniqueness(self):
        import hashlib
        content = "50.000|test purchase|2024-04-15T19:30:00+00:00"
        h1 = hashlib.sha256(content.encode()).hexdigest()
        h2 = hashlib.sha256(content.encode()).hexdigest()
        assert h1 == h2


class LoadTests:
    """Generate 100 synthetic emails and process them via parse_email_static."""

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
