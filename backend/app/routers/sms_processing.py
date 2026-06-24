"""
SMS Processing Router
Receives Bancolombia SMS notifications via webhook and processes them.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.db.supabase_client import get_supabase_client
from app.services.sms_parser import parse_sms, SmsParseResult


router = APIRouter(prefix="/api/sms", tags=["SMS Processing"])


class SmsInput(BaseModel):
    """SMS submission for processing."""
    message: str
    phone_number: Optional[str] = None


def _categorize(result: SmsParseResult, categories: list[dict]) -> Optional[str]:
    """Static categorization based on description keywords."""
    desc_lower = result.description.lower()

    if result.type == "ingreso":
        if "transferencia" in desc_lower and "recibida" in desc_lower:
            return _find_category(categories, "Transferencia")
        return _find_category(categories, "Otro")
    else:
        if "compra" in desc_lower:
            commerce = desc_lower.split("-")[-1].strip() if "-" in desc_lower else desc_lower
            commerce_kw = commerce.lower()
            if any(k in commerce_kw for k in ["exito", "jumbo", "carulla", "d1", "ara", "mercado", "supermercado", "alimentos"]):
                return _find_category(categories, "Alimentación")
            if any(k in commerce_kw for k in ["uber", "cabify", "didi", "taxi", "gasolina", "combustible", "peaje"]):
                return _find_category(categories, "Transporte")
            if any(k in commerce_kw for k in ["netflix", "spotify", "cine", "entretenimiento"]):
                return _find_category(categories, "Entretenimiento")
            if any(k in commerce_kw for k in ["epm", "tigo", "claro", "movistar", "servicios"]):
                return _find_category(categories, "Servicios")
            return _find_category(categories, "Otro")
        if "transferencia" in desc_lower and "enviada" in desc_lower:
            return _find_category(categories, "Transferencia")

    return _find_category(categories, "Otro")


def _find_category(categories: list[dict], name: str) -> Optional[str]:
    """Find category ID by name."""
    for cat in categories:
        if cat["name"].lower() == name.lower():
            return cat["id"]
    return None


@router.post("/process")
async def process_sms(sms: SmsInput):
    """
    Process a Bancolombia SMS notification.
    Parses, categorizes, deduplicates, and registers as transaction.
    """
    supabase = get_supabase_client()

    result = parse_sms(sms.message)

    if result is None:
        raise HTTPException(
            status_code=422,
            detail="Could not extract transaction data from this SMS"
        )

    existing = (
        supabase.table("transactions")
        .select("id")
        .eq("amount", float(result.amount))
        .eq("type", result.type)
        .eq("source", result.source)
        .gte("transaction_date", result.transaction_date.date().isoformat())
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="Transaction already registered")

    categories_res = supabase.table("categories").select("*").execute()
    categories = categories_res.data or []

    category_id = _categorize(result, categories)

    transaction_data = {
        "type": result.type,
        "amount": float(result.amount),
        "currency": "COP",
        "description": result.description,
        "source": result.source,
        "raw_email_content": result.raw_content,
        "parsed_data": {
            "parse_method": "sms_regex",
            "confidence": result.confidence,
        },
        "llm_enrichment": None,
        "category_id": category_id,
        "transaction_date": result.transaction_date.date().isoformat(),
    }

    tx_result = supabase.table("transactions").insert(transaction_data).execute()

    return {
        "success": True,
        "transaction": tx_result.data[0] if tx_result.data else None,
        "parse_method": "sms_regex",
        "confidence": result.confidence,
    }


@router.post("/test-parse")
async def test_parse_sms(sms: SmsInput):
    """Test SMS parsing without saving to database. Debug utility."""
    result = parse_sms(sms.message)
    return {
        "result": {
            "type": result.type,
            "amount": float(result.amount),
            "description": result.description,
            "transaction_date": result.transaction_date.isoformat(),
            "confidence": result.confidence,
        } if result else None,
        "raw": sms.message[:100],
    }
