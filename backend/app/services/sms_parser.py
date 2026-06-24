"""
Bancolombia SMS Parser
Extracts transaction data from Bancolombia SMS notifications.
Handles three types: transferencia recibida, compra TD, transferencia enviada.
"""

import re
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass


@dataclass
class SmsParseResult:
    """Result of parsing a Bancolombia SMS."""
    type: str  # "ingreso" or "egreso"
    amount: Decimal
    description: str
    transaction_date: datetime
    raw_content: str
    confidence: float
    source: str = "bancolombia_sms"


BOGOTA_TZ = timezone.utc


TRANSFERENCIA_RECIBIDA_PATTERN = re.compile(
    r"Bancolombia:\s*JOSE,\s*recibiste\s+una\s+transferencia\s+de\s+(.+?)\s+por\s+\$([\d.,]+)\s+"
    r"en\s+tu\s+cuenta\s+\*(\d+)\s+conectada\s+a\s+la\s+llave\s+\d+\s+"
    r"el\s+(\d{2}/\d{2}/\d{2,4})\s+a\s+las\s+(\d{2}:\d{2})",
    re.IGNORECASE | re.DOTALL,
)

COMPRA_TD_PATTERN = re.compile(
    r"Bancolombia:\s*Compraste\s+\$([\d.,]+)\s+en\s+(.+?)\s+con\s+tu\s+T\.Deb\s+\*(\d+),?"
    r"(?:\s+el\s+(\d{2}/\d{2}/\d{4})\s+a\s+las\s+(\d{2}:\d{2}))?",
    re.IGNORECASE | re.DOTALL,
)

TRANSFERENCIA_ENVIADA_PATTERN = re.compile(
    r"Bancolombia:\s*JOSE,\s*transferiste\s+\$([\d.,]+)\s+a\s+la\s+llave\s+(\d+)\s+"
    r"desde\s+tu\s+cuenta\s+\*(\d+)\s+a\s+(.+?)\s+"
    r"el\s+(\d{2}/\d{2}/\d{2,4})\s+a\s+las\s+(\d{2}:\d{2})",
    re.IGNORECASE | re.DOTALL,
)


def parse_amount(amount_str: str) -> Decimal:
    """Parse Colombian peso amount string to Decimal.

    Colombian format: 37.400,00 (dot=thousands, comma=decimal)
    US format: 37,400.00 (comma=thousands, dot=decimal)
    """
    cleaned = amount_str.strip()

    if "." in cleaned and "," in cleaned:
        dot_idx = cleaned.rfind(".")
        comma_idx = cleaned.rfind(",")
        if dot_idx < comma_idx:
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        if len(cleaned.split(",")[-1]) <= 2:
            cleaned = cleaned.replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "." in cleaned:
        parts = cleaned.split(".")
        if len(parts[-1]) == 3:
            cleaned = cleaned.replace(".", "")

    try:
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        numeric = re.sub(r"[^\d.]", "", cleaned)
        return Decimal(numeric) if numeric else Decimal("0")


def parse_sms_date(date_str: str, time_str: str, year_length: int = 2) -> datetime:
    """Parse DD/MM/YY or DD/MM/YYYY date with HH:MM time to UTC (Bogota)."""
    day, month, year = date_str.split("/")
    if len(year) == 2:
        year = "20" + year

    dt = datetime(
        int(year),
        int(month),
        int(day),
        int(time_str.split(":")[0]),
        int(time_str.split(":")[1]),
    )
    return dt.replace(tzinfo=BOGOTA_TZ)


def parse_sms_date_full(date_str: str, time_str: str) -> datetime:
    """Parse DD/MM/YYYY date with HH:MM time to UTC (Bogota)."""
    return parse_sms_date(date_str, time_str, year_length=4)


def parse_sms(message: str) -> Optional[SmsParseResult]:
    """
    Parse a Bancolombia SMS and extract transaction data.
    Returns None if the SMS doesn't match known patterns.
    """
    msg_clean = message.strip()

    match = TRANSFERENCIA_RECIBIDA_PATTERN.search(msg_clean)
    if match:
        person = match.group(1).strip()
        amount = parse_amount(match.group(2))
        account = match.group(3)
        date_str = match.group(4)
        time_str = match.group(5)

        return SmsParseResult(
            type="ingreso",
            amount=amount,
            description=f"Transferencia recibida - {person}",
            transaction_date=parse_sms_date(date_str, time_str),
            raw_content=msg_clean[:200],
            confidence=0.95,
        )

    match = COMPRA_TD_PATTERN.search(msg_clean)
    if match:
        amount = parse_amount(match.group(1))
        commerce = match.group(2).strip()
        account = match.group(3)
        date_str = match.group(4) if match.group(4) else None
        time_str = match.group(5) if match.group(5) else None

        if date_str and time_str:
            tx_date = parse_sms_date_full(date_str, time_str)
        else:
            tx_date = datetime.now(timezone.utc)

        return SmsParseResult(
            type="egreso",
            amount=amount,
            description=f"Compra - {commerce}",
            transaction_date=tx_date,
            raw_content=msg_clean[:200],
            confidence=0.95,
        )

    match = TRANSFERENCIA_ENVIADA_PATTERN.search(msg_clean)
    if match:
        amount = parse_amount(match.group(1))
        account = match.group(3)
        recipient = match.group(4).strip()
        date_str = match.group(5)
        time_str = match.group(6)

        return SmsParseResult(
            type="egreso",
            amount=amount,
            description=f"Transferencia enviada - {recipient}",
            transaction_date=parse_sms_date(date_str, time_str),
            raw_content=msg_clean[:200],
            confidence=0.95,
        )

    return None
