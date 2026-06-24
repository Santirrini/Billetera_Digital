"""
LLM Processor
Uses OpenAI (or compatible) to process and enrich transaction data.
Handles dynamic parsing and intelligent categorization.
"""

import json
from typing import Optional
from datetime import datetime
from decimal import Decimal
from openai import OpenAI
from app.config import get_settings
from app.models.schemas import EmailParseResult, TransactionType


def get_openai_client() -> Optional[OpenAI]:
    """Create OpenAI client if API key is configured."""
    settings = get_settings()
    if not settings.openai_api_key or settings.openai_api_key == "your_openai_api_key_here":
        return None
    return OpenAI(api_key=settings.openai_api_key)


def parse_email_with_llm(subject: str, body: str) -> Optional[EmailParseResult]:
    """
    Parse a Bancolombia email using LLM (dynamic evaluation).
    Used when regex parsing fails or has low confidence.
    """
    client = get_openai_client()
    if not client:
        return None

    prompt = f"""Analiza este correo de notificación bancaria de Bancolombia y extrae la información de la transacción.

Asunto: {subject}
Contenido: {body[:2000]}

Responde SOLO con un JSON válido con esta estructura:
{{
    "type": "ingreso" o "egreso",
    "amount": número decimal (sin símbolo de moneda),
    "description": "descripción corta de la transacción",
    "transaction_date": "YYYY-MM-DD HH:MM:SS",
    "confidence": número entre 0 y 1
}}

Si no puedes extraer la información, responde: {{"error": "no se pudo extraer"}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Eres un experto en procesamiento de notificaciones bancarias colombianas. Extraes datos precisos de transacciones.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=300,
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)

        if "error" in result:
            return None

        return EmailParseResult(
            type=TransactionType(result["type"]),
            amount=Decimal(str(result["amount"])),
            description=result.get("description", "Transacción"),
            transaction_date=datetime.fromisoformat(result["transaction_date"]),
            raw_content=body[:500],
            confidence=float(result.get("confidence", 0.9)),
            parse_method="llm",
        )

    except Exception as e:
        print(f"LLM parsing error: {e}")
        return None


def enrich_transaction_with_llm(
    description: str,
    amount: float,
    tx_type: str,
    categories: list[dict],
) -> Optional[dict]:
    """
    Use LLM to enrich a transaction with category suggestion and insights.
    This implements the feedback loop from the flow diagram.
    """
    client = get_openai_client()
    if not client:
        return None

    categories_str = ", ".join([f"{c['name']} ({c['icon']})" for c in categories])

    prompt = f"""Analiza esta transacción y sugiere una categorización:

Tipo: {tx_type}
Monto: ${amount:,.2f} COP
Descripción: {description}

Categorías disponibles: {categories_str}

Responde SOLO con JSON:
{{
    "suggested_category": "nombre de la categoría más apropiada",
    "tags": ["tag1", "tag2"],
    "summary": "resumen en una línea de la transacción",
    "is_recurring": true/false,
    "merchant_type": "tipo de comercio si aplica"
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Eres un asistente financiero personal que categoriza transacciones bancarias colombianas.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=200,
            response_format={"type": "json_object"},
        )

        return json.loads(response.choices[0].message.content)

    except Exception as e:
        print(f"LLM enrichment error: {e}")
        return None
