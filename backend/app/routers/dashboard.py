"""
Dashboard Router
Provides aggregated statistics and summaries for the frontend.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Query
from typing import Optional
from app.db.supabase_client import get_supabase_client

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def _period_date_range(period: str) -> Optional[str]:
    now = datetime.utcnow()
    if period == "week":
        return (now - timedelta(days=7)).isoformat()
    elif period == "month":
        return (now - timedelta(days=30)).isoformat()
    elif period == "year":
        return (now - timedelta(days=365)).isoformat()
    return None


@router.get("/stats")
async def get_dashboard_stats(
    period: str = Query(default="month", enum=["week", "month", "year", "all"]),
    recent_limit: int = Query(default=10, ge=1, le=200),
    recent_offset: int = Query(default=0, ge=0),
):
    """Get dashboard statistics for a given time period."""
    supabase = get_supabase_client()

    query = supabase.table("transactions").select(
        "id, type, amount, category_id, transaction_date, description, categories(name, icon, color)"
    )

    start_date = _period_date_range(period)
    if start_date:
        query = query.gte("transaction_date", start_date)

    result = query.order("transaction_date", desc=True).execute()
    transactions = result.data or []

    total_ingresos = sum(
        float(t["amount"]) for t in transactions if t["type"] == "ingreso"
    )
    total_egresos = sum(
        float(t["amount"]) for t in transactions if t["type"] == "egreso"
    )
    total_balance = total_ingresos - total_egresos

    category_totals = {}
    for t in transactions:
        if t["type"] == "egreso" and t.get("categories"):
            cat = t["categories"]
            cat_name = cat["name"]
            if cat_name not in category_totals:
                category_totals[cat_name] = {
                    "name": cat_name,
                    "icon": cat["icon"],
                    "color": cat["color"],
                    "total": 0,
                    "count": 0,
                }
            category_totals[cat_name]["total"] += float(t["amount"])
            category_totals[cat_name]["count"] += 1

    top_categories = sorted(
        category_totals.values(), key=lambda x: x["total"], reverse=True
    )[:5]

    recent = transactions[recent_offset : recent_offset + recent_limit]

    return {
        "total_balance": total_balance,
        "total_ingresos": total_ingresos,
        "total_egresos": total_egresos,
        "transaction_count": len(transactions),
        "top_categories": top_categories,
        "recent_transactions": recent,
    }


@router.get("/categories")
async def get_categories():
    """Get all transaction categories."""
    supabase = get_supabase_client()
    result = supabase.table("categories").select("*").order("name").execute()
    return {"data": result.data}
