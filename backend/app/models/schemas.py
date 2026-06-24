from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional
from decimal import Decimal
from enum import Enum


class TransactionType(str, Enum):
    INGRESO = "ingreso"
    EGRESO = "egreso"


class TransactionCreate(BaseModel):
    """Schema for creating a new transaction."""
    type: TransactionType
    amount: Decimal = Field(..., gt=0)
    currency: str = "COP"
    description: Optional[str] = None
    category_id: Optional[str] = None
    source: str = "bancolombia"
    raw_email_content: Optional[str] = None
    parsed_data: Optional[dict] = None
    llm_enrichment: Optional[dict] = None
    transaction_date: datetime

    @field_validator("transaction_date")
    @classmethod
    def ensure_aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("transaction_date must be timezone-aware (UTC)")
        return v

class TransactionResponse(BaseModel):
    """Schema for transaction API responses."""
    id: str
    type: str
    amount: float
    currency: str
    description: Optional[str]
    category_id: Optional[str]
    source: str
    parsed_data: Optional[dict]
    llm_enrichment: Optional[dict]
    transaction_date: str
    created_at: str


class TransactionUpdate(BaseModel):
    """Schema for updating a transaction."""
    type: Optional[TransactionType] = None
    amount: Optional[Decimal] = None
    description: Optional[str] = None
    category_id: Optional[str] = None


class CategoryResponse(BaseModel):
    """Schema for category API responses."""
    id: str
    name: str
    icon: Optional[str]
    color: Optional[str]
    is_default: bool


class EmailParseResult(BaseModel):
    """Result of parsing a Bancolombia email."""
    type: TransactionType
    amount: Decimal
    description: str
    transaction_date: datetime
    raw_content: str
    confidence: float = Field(ge=0, le=1)
    parse_method: str = "regex"  # "regex" or "llm"


class DashboardStats(BaseModel):
    """Dashboard statistics."""
    total_balance: float
    total_ingresos: float
    total_egresos: float
    transaction_count: int
    top_categories: list[dict]
    recent_transactions: list[dict]
