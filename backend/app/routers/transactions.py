"""
Transactions Router
CRUD operations for financial transactions.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.db.supabase_client import get_supabase_client
from app.models.schemas import TransactionCreate, TransactionResponse, TransactionUpdate

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


def _period_date_range(period: str) -> Optional[str]:
    now = datetime.utcnow()
    if period == "week":
        return (now - timedelta(days=7)).isoformat()
    elif period == "month":
        return (now - timedelta(days=30)).isoformat()
    elif period == "year":
        return (now - timedelta(days=365)).isoformat()
    return None


@router.get("/")
async def list_transactions(
    type: Optional[str] = None,
    category_id: Optional[str] = None,
    period: Optional[str] = Query(default=None, enum=["week", "month", "year", "all"]),
    limit: int = Query(default=50, le=200),
    offset: int = 0,
):
    """List transactions with optional filters."""
    supabase = get_supabase_client()

    query = supabase.table("transactions").select("*, categories(name, icon, color)")

    if type:
        query = query.eq("type", type)
    if category_id:
        query = query.eq("category_id", category_id)
    if period and period != "all":
        start_date = _period_date_range(period)
        if start_date:
            query = query.gte("transaction_date", start_date)

    result = (
        query.order("transaction_date", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return {"data": result.data, "count": len(result.data)}


@router.get("/{transaction_id}")
async def get_transaction(transaction_id: str):
    """Get a single transaction by ID."""
    supabase = get_supabase_client()
    result = (
        supabase.table("transactions")
        .select("*, categories(name, icon, color)")
        .eq("id", transaction_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return result.data


@router.post("/", status_code=201)
async def create_transaction(transaction: TransactionCreate):
    """Create a new transaction."""
    supabase = get_supabase_client()

    data = transaction.model_dump(mode="json")
    data["transaction_date"] = data["transaction_date"]

    result = supabase.table("transactions").insert(data).execute()
    return result.data[0]


@router.patch("/{transaction_id}")
async def update_transaction(transaction_id: str, update: TransactionUpdate):
    """Update an existing transaction."""
    supabase = get_supabase_client()

    data = update.model_dump(exclude_none=True, mode="json")
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("transactions")
        .update(data)
        .eq("id", transaction_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return result.data[0]


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(transaction_id: str):
    """Delete a transaction."""
    supabase = get_supabase_client()
    supabase.table("transactions").delete().eq("id", transaction_id).execute()
    return None
