"""
Email Processing Router
Handles email parsing, processing pipeline, and manual email submission.
Implements the full flow: Extract → Evaluate → Clean → Register → LLM Organize
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.db.supabase_client import get_supabase_client
from app.services.email_parser import parse_email_static
from app.services.llm_processor import parse_email_with_llm, enrich_transaction_with_llm
from app.models.schemas import TransactionType

router = APIRouter(prefix="/api/email", tags=["Email Processing"])


class EmailInput(BaseModel):
    """Manual email submission for processing."""
    subject: str
    body: str
    message_id: Optional[str] = None
    email_date: Optional[str] = None


@router.post("/process")
async def process_email(email: EmailInput):
    """
    Process a Bancolombia notification email through the full pipeline:
    1. Extract content
    2. Evaluate (static vs dynamic)
    3. Clean data
    4. Register as ingreso/egreso
    5. LLM enrichment (organize info)
    """
    supabase = get_supabase_client()

    # Check if already processed
    if email.message_id:
        existing = (
            supabase.table("processed_emails")
            .select("id")
            .eq("email_message_id", email.message_id)
            .execute()
        )
        if existing.data:
            raise HTTPException(status_code=409, detail="Email already processed")

    # Step 1 & 2: Try static parsing first (regex)
    parse_result = parse_email_static(email.subject, email.body, email.email_date)

    # Step 2b: If static fails or low confidence, try LLM (dynamic)
    if parse_result is None or parse_result.confidence < 0.6:
        llm_result = parse_email_with_llm(email.subject, email.body)
        if llm_result:
            parse_result = llm_result

    if parse_result is None:
        # Record failed processing
        if email.message_id:
            supabase.table("processed_emails").insert({
                "email_message_id": email.message_id or f"manual_{hash(email.body)}",
                "subject": email.subject,
                "status": "error",
                "error_message": "Could not extract transaction data",
            }).execute()

        raise HTTPException(
            status_code=422,
            detail="Could not extract transaction data from this email"
        )

    # Step 3 & 4: Clean and register transaction
    transaction_data = {
        "type": parse_result.type.value,
        "amount": float(parse_result.amount),
        "currency": "COP",
        "description": parse_result.description,
        "source": "bancolombia",
        "raw_email_content": parse_result.raw_content,
        "parsed_data": {
            "parse_method": parse_result.parse_method,
            "confidence": parse_result.confidence,
        },
        "transaction_date": parse_result.transaction_date.date().isoformat(),
    }

    # Step 5: Categorization (Static fallback + LLM enrichment)
    categories_res = supabase.table("categories").select("*").execute()
    categories = categories_res.data or []
    
    # Static fallback categorization based on description/type
    suggested_category_name = None
    desc_lower = parse_result.description.lower()
    
    if parse_result.type == TransactionType.INGRESO:
        if "nomina" in desc_lower or "nómina" in desc_lower:
            suggested_category_name = "Salario"
        else:
            suggested_category_name = "Transferencia"
    else:
        # Egresos
        if any(k in desc_lower for k in ["exito", "jumbo", "carulla", "d1", "ara", "restaurante", "comida", "carnes"]):
            suggested_category_name = "Alimentación"
        elif any(k in desc_lower for k in ["uber", "cabify", "didi", "taxi", "combustible", "gasolinera", "peaje"]):
            suggested_category_name = "Transporte"
        elif any(k in desc_lower for k in ["epm", "tigo", "claro", "movistar", "une", "servicios"]):
            suggested_category_name = "Servicios"
        elif any(k in desc_lower for k in ["netflix", "spotify", "cine", "boleta", "entretenimiento"]):
            suggested_category_name = "Entretenimiento"
        elif any(k in desc_lower for k in ["transferencia", "enviada"]):
            suggested_category_name = "Transferencia"
        else:
            suggested_category_name = "Otro"

    # Match suggested category to actual category ID
    if suggested_category_name:
        for cat in categories:
            if cat["name"].lower() == suggested_category_name.lower():
                transaction_data["category_id"] = cat["id"]
                break

    # If LLM is available, enrich and potentially override category
    enrichment = enrich_transaction_with_llm(
        description=parse_result.description,
        amount=float(parse_result.amount),
        tx_type=parse_result.type.value,
        categories=categories,
    )

    if enrichment:
        transaction_data["llm_enrichment"] = enrichment
        if "suggested_category" in enrichment:
            for cat in categories:
                if cat["name"].lower() == enrichment["suggested_category"].lower():
                    transaction_data["category_id"] = cat["id"]
                    break

    # Save transaction
    tx_result = supabase.table("transactions").insert(transaction_data).execute()

    # Mark email as processed
    if email.message_id:
        supabase.table("processed_emails").insert({
            "email_message_id": email.message_id,
            "subject": email.subject,
            "status": "processed",
            "transaction_id": tx_result.data[0]["id"] if tx_result.data else None,
        }).execute()

    return {
        "success": True,
        "transaction": tx_result.data[0] if tx_result.data else None,
        "enrichment": enrichment,
        "parse_method": parse_result.parse_method,
        "confidence": parse_result.confidence,
    }


@router.post("/test-parse")
async def test_parse_email(email: EmailInput):
    """Test email parsing without saving to database. Useful for debugging."""
    result = parse_email_static(email.subject, email.body, email.email_date)

    llm_result = None
    if result is None or result.confidence < 0.6:
        llm_result = parse_email_with_llm(email.subject, email.body)

    return {
        "static_result": result.model_dump() if result else None,
        "llm_result": llm_result.model_dump() if llm_result else None,
        "recommended": "llm" if (result and result.confidence < 0.6) else "static",
    }
