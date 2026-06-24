"""
Bancolombia Email Parser
Extracts transaction data from Bancolombia notification emails.
Supports both regex (static) and LLM (dynamic) parsing strategies.
"""

import re
import email.utils
from decimal import Decimal
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import logging

logger = logging.getLogger(__name__)
from typing import Optional
from bs4 import BeautifulSoup
from app.models.schemas import EmailParseResult, TransactionType


# Common patterns in Bancolombia emails
BANCOLOMBIA_PATTERNS = {
    "compra": {
        "pattern": r"(?:compra por|compra).*?\$\s*([\d.,]+(?:\d{2,3})?)",
        "type": TransactionType.EGRESO,
    },
    "transferencia_enviada": {
        "pattern": r"(?:transferencia\s+enviada|transferiste|transferencia.*?desde\s+cta|transferencia.*?a\s+cta).*?\$\s*([\d.,]+(?:\d{2,3})?)",
        "type": TransactionType.EGRESO,
    },
    "transferencia_recibida": {
        "pattern": r"(?:transferencia\s+recibida|recibiste\s+una?\s+transferencia|recepcion\s+transferencia|transferencia.*?en\s+(?:tu|la)\s+cuenta).*?\$\s*([\d.,]+(?:\d{2,3})?)",
        "type": TransactionType.INGRESO,
    },
    "transferencia": {
        "pattern": r"(?:transferencia|transferiste).*?\$\s*([\d.,]+(?:\d{2,3})?)",
        "type": TransactionType.EGRESO,
    },
    "consignacion": {
        "pattern": r"(?:consignaci[oó]n).*?\$\s*([\d.,]+(?:\d{2,3})?)",
        "type": TransactionType.INGRESO,
    },
    "pago_pse": {
        "pattern": r"(?:pago.*?PSE|PSE).*?\$\s*([\d.,]+(?:\d{2,3})?)",
        "type": TransactionType.EGRESO,
    },
    "retiro": {
        "pattern": r"(?:retiro).*?\$\s*([\d.,]+(?:\d{2,3})?)",
        "type": TransactionType.EGRESO,
    },
    "pago_nomina": {
        "pattern": r"(?:pago|abono).*?n[oó]mina.*?\$\s*([\d.,]+(?:\d{2,3})?)",
        "type": TransactionType.INGRESO,
    },
}

# Generic amount pattern as fallback (more robust)
AMOUNT_PATTERN = r"\$\s*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)"

# Multiple date formats found in Bancolombia notification emails
DATE_PATTERNS = [
    (r"(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})", "%d/%m/%Y %H:%M:%S"),  # 15/04/2024 14:30:00
    (r"(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2})", "%d/%m/%Y %H:%M"),            # 15/04/2024 14:30
    (r"(\d{2}/\d{2}/\d{4})", "%d/%m/%Y"),                                  # 15/04/2024
    (r"(\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2})", "%d/%m/%Y %H:%M:%S"),  # 5/4/2024 14:30:00
    (r"(\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2})", "%d/%m/%Y %H:%M"),          # 5/4/2024 14:30
    (r"(\d{1,2}/\d{1,2}/\d{4})", "%d/%m/%Y"),                                # 5/4/2024
    (r"(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})", "%Y-%m-%d %H:%M:%S"),   # 2024-04-15 14:30:00
    (r"(\d{4}-\d{2}-\d{2})", "%Y-%m-%d"),                                   # 2024-04-15
    (r"(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})", "%d-%m-%Y %H:%M:%S"),  # 15-04-2024 14:30:00
    (r"(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2})", "%d-%m-%Y %H:%M"),            # 15-04-2024 14:30
    (r"(\d{2}-\d{2}-\d{4})", "%d-%m-%Y"),                                  # 15-04-2024
    # ISO format with slashes (yyyy/mm/dd) — used by QR transfer emails
    (r"(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})", "%Y/%m/%d %H:%M:%S"),  # 2024/04/15 14:30:00
    (r"(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2})", "%Y/%m/%d %H:%M"),            # 2024/04/15 14:30
    (r"(\d{4}/\d{2}/\d{2})", "%Y/%m/%d"),                                  # 2024/04/15
    # 2-digit year with slashes (dd/mm/yy) — used by Bre-B emails
    (r"(\d{1,2}/\d{1,2}/\d{2}\s+\d{1,2}:\d{2}:\d{2})", "%d/%m/%y %H:%M:%S"),  # 15/04/24 14:30:00
    (r"(\d{1,2}/\d{1,2}/\d{2}\s+\d{1,2}:\d{2})", "%d/%m/%y %H:%M"),          # 15/04/24 14:30
    (r"(\d{1,2}/\d{1,2}/\d{2})", "%d/%m/%y"),                                # 15/04/24
]

# Spanish month names for date formats like "15 de abril de 2024"
SPANISH_MONTHS = {
    "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
    "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
    "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12",
}
SPANISH_DATE_PATTERN = r"(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})"

BOGOTA_TZ = ZoneInfo("America/Bogota")


def normalize_to_utc(dt: datetime, source_tz=None) -> datetime:
    """Convert a datetime to UTC. If naive, assume source_tz (default Bogota)."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc)
    tz = source_tz or BOGOTA_TZ
    return dt.replace(tzinfo=tz).astimezone(timezone.utc)


# More flexible description pattern
DESCRIPTION_PATTERN = r"(?:en|desde|hacia|a|en el comercio)\s+([A-Z\d][\w\s.\-]+?)(?:\.|,|\s+\d|(?:\s+el\s+\d{2}))"


def try_parse_date(text: str) -> Optional[datetime]:
    """Try all date patterns and return the first match, or None."""
    # Try numeric patterns first
    for pattern, fmt in DATE_PATTERNS:
        match = re.search(pattern, text)
        if match:
            try:
                return datetime.strptime(match.group(1), fmt)
            except ValueError:
                continue

    # Try Spanish month names
    match = re.search(SPANISH_DATE_PATTERN, text, re.IGNORECASE)
    if match:
        day, month_name, year = match.group(1), match.group(2).lower(), match.group(3)
        month_num = SPANISH_MONTHS.get(month_name)
        if month_num:
            try:
                return datetime.strptime(f"{day}/{month_num}/{year}", "%d/%m/%Y")
            except ValueError:
                pass

    return None


def parse_email_date_header(header: str) -> Optional[datetime]:
    """Parse an RFC 2822 email Date header using the stdlib parser."""
    if not header:
        return None
    try:
        parsed = email.utils.parsedate_to_datetime(header)
        return parsed
    except Exception:
        return None


def parse_amount(amount_str: str) -> Decimal:
    """
    Parse Colombian peso amount string to Decimal.
    Colombian format typically uses '.' for thousands and ',' for decimals.
    Example: "45.000,00" -> 45000.00
    Or sometimes: "45,000.00" or just "45.000"
    """
    # Remove any currency symbols and whitespace
    cleaned = amount_str.replace("$", "").replace(" ", "").strip()
    
    # Logic to handle both formats: 1.000,00 and 1,000.00
    # If there is both a dot and a comma
    if "." in cleaned and "," in cleaned:
        dot_idx = cleaned.find(".")
        comma_idx = cleaned.find(",")
        if dot_idx < comma_idx:
            # Format: 1.000,00 (Standard Colombian)
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            # Format: 1,000.00 (Standard US)
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        # If only comma, check if it's likely a decimal or thousands separator
        # In Bancolombia emails, a single comma at the end is usually decimal (e.g. 45.000,00 -> 45000,00)
        # If it's 3 digits after the comma, it MIGHT be thousands, but usually bank emails use dots for thousands.
        if len(cleaned.split(",")[-1]) <= 2:
            cleaned = cleaned.replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "." in cleaned:
        # If only dots, and it's something like "45.000", those are thousands
        parts = cleaned.split(".")
        if len(parts[-1]) == 3:
            cleaned = cleaned.replace(".", "")
        # If it's "3.4", in the context of COP, it's very unlikely to be 3 pesos. 
        # It's likely 3,400 but the parser missed the rest or the email format changed.
        # However, if the regex captured "3.4", we should treat it as 3.4 for now 
        # but fix the regex to capture more.
    
    try:
        return Decimal(cleaned)
    except Exception:
        # Fallback to digits only
        numeric_only = re.sub(r"[^\d.]", "", cleaned.replace(",", "."))
        return Decimal(numeric_only) if numeric_only else Decimal("0")


def extract_text_from_html(html_content: str) -> str:
    """Extract clean text from HTML email content."""
    soup = BeautifulSoup(html_content, "html.parser")
    # Remove script and style elements
    for tag in soup(["script", "style"]):
        tag.decompose()
    return soup.get_text(separator=" ", strip=True)


def parse_email_static(subject: str, body: str, email_date: Optional[str] = None) -> Optional[EmailParseResult]:
    """
    Parse a Bancolombia email using regex patterns (static evaluation).
    Falls back to the email's Date header if no date is found in the body.
    Returns None if no pattern matches.
    """
    # Clean the body
    text = body
    if "<html" in body.lower() or "<body" in body.lower():
        text = extract_text_from_html(body)

    full_text = f"{subject} {text}"

    # Shared: try to extract date from email body
    raw_date = try_parse_date(full_text)
    date_from_body = raw_date is not None

    # If no date found in body, fall back to email Date header
    if raw_date is None:
        raw_date = parse_email_date_header(email_date) if email_date else None

    # Normalize to UTC-aware datetime
    if raw_date is not None:
        date_source = "body_regex" if date_from_body else "email_header"
        transaction_date = normalize_to_utc(raw_date)
        logger.info(
            "date_extraction",
            extra={
                "method": date_source,
                "original": raw_date.isoformat(),
                "normalized": transaction_date.isoformat(),
                "timezone_assumed": "America/Bogota" if raw_date.tzinfo is None else "from_offset",
            }
        )
    else:
        transaction_date = datetime.now(timezone.utc)
        logger.info(
            "date_extraction",
            extra={
                "method": "now",
                "original": "",
                "normalized": transaction_date.isoformat(),
                "timezone_assumed": "UTC",
            }
        )

    # Try each Bancolombia pattern
    for pattern_name, pattern_info in BANCOLOMBIA_PATTERNS.items():
        match = re.search(pattern_info["pattern"], full_text, re.IGNORECASE | re.DOTALL)
        if match:
            amount = parse_amount(match.group(1))

            # Try to extract description
            desc_match = re.search(DESCRIPTION_PATTERN, full_text)
            description = f"{pattern_name.replace('_', ' ').title()}"
            if desc_match:
                description = f"{description} - {desc_match.group(1).strip()}"

            return EmailParseResult(
                type=pattern_info["type"],
                amount=amount,
                description=description,
                transaction_date=transaction_date,
                raw_content=full_text[:500],
                confidence=0.85,
                parse_method="regex",
            )

    # Fallback: try generic amount extraction
    amount_match = re.search(AMOUNT_PATTERN, full_text)
    if amount_match and "bancolombia" in full_text.lower():
        amount = parse_amount(amount_match.group(1))

        # Guess type from keywords (only scan first 500 chars to avoid footer noise)
        ingreso_keywords = ["consignación", "recibida", "recibiste", "abono", "nómina", "depósito", "recepcion", "ingreso"]
        egreso_keywords = ["compra", "pago", "retiro", "débito", "enviada", "transferi"]

        text_lower = full_text[:500].lower()
        is_ingreso = any(kw in text_lower for kw in ingreso_keywords)
        is_egreso = any(kw in text_lower for kw in egreso_keywords)

        tx_type = TransactionType.INGRESO if is_ingreso else (
            TransactionType.EGRESO if is_egreso else TransactionType.EGRESO
        )

        return EmailParseResult(
            type=tx_type,
            amount=amount,
            description=subject or "Transacción Bancolombia",
            transaction_date=transaction_date,
            raw_content=full_text[:500],
            confidence=0.5,
            parse_method="regex_fallback",
        )

    return None
