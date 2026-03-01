"""Finance schemas for API request/response handling."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.db.models.finance import (
    AccountType,
    BillingCycle,
    TransactionCategory,
    TransactionSource,
    TransactionType,
)
from app.schemas.base import BaseSchema, TimestampSchema

# ──────────────────────────── Financial Account ─────────────────────────────


class FinancialAccountBase(BaseSchema):
    name: str = Field(max_length=255, description="Account name (e.g. 'Chase Checking')")
    institution: str | None = Field(default=None, max_length=255)
    account_type: AccountType = AccountType.CHECKING
    last_four: str | None = Field(default=None, max_length=4, description="Last 4 digits")
    currency: str = Field(default="USD", max_length=3)
    is_active: bool = True
    notes: str | None = None


class FinancialAccountCreate(FinancialAccountBase):
    pass


class FinancialAccountUpdate(BaseSchema):
    name: str | None = Field(default=None, max_length=255)
    institution: str | None = None
    account_type: AccountType | None = None
    last_four: str | None = Field(default=None, max_length=4)
    currency: str | None = Field(default=None, max_length=3)
    is_active: bool | None = None
    notes: str | None = None


class FinancialAccountBalanceUpdate(BaseSchema):
    current_balance: Decimal = Field(description="Updated current balance")


class FinancialAccountResponse(FinancialAccountBase, TimestampSchema):
    id: UUID
    user_id: UUID
    current_balance: Decimal | None = None
    balance_updated_at: datetime | None = None


# ──────────────────────────── Transaction ────────────────────────────────────


class TransactionBase(BaseSchema):
    amount: Decimal = Field(description="Positive = income/credit, negative = expense/debit")
    description: str = Field(max_length=500)
    merchant: str | None = Field(default=None, max_length=255)
    transaction_date: date
    posted_date: date | None = None
    transaction_type: TransactionType = TransactionType.DEBIT
    notes: str | None = None


class TransactionCreate(TransactionBase):
    account_id: UUID | None = None
    category: TransactionCategory | None = None
    source: TransactionSource = TransactionSource.MANUAL
    raw_email_id: str | None = None
    recurring_expense_id: UUID | None = None


class TransactionUpdate(BaseSchema):
    amount: Decimal | None = None
    description: str | None = Field(default=None, max_length=500)
    merchant: str | None = None
    transaction_date: date | None = None
    posted_date: date | None = None
    transaction_type: TransactionType | None = None
    category: TransactionCategory | None = None
    account_id: UUID | None = None
    recurring_expense_id: UUID | None = None
    is_reviewed: bool | None = None
    notes: str | None = None


class TransactionResponse(TransactionBase, TimestampSchema):
    id: UUID
    user_id: UUID
    account_id: UUID | None = None
    recurring_expense_id: UUID | None = None
    category: TransactionCategory | None = None
    category_confidence: float | None = None
    source: TransactionSource = TransactionSource.MANUAL
    raw_email_id: str | None = None
    is_reviewed: bool = False


class TransactionListResponse(BaseSchema):
    transactions: list[TransactionResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class TransactionFilters(BaseSchema):
    account_id: UUID | None = None
    category: TransactionCategory | None = None
    source: TransactionSource | None = None
    transaction_type: TransactionType | None = None
    date_from: date | None = None
    date_to: date | None = None
    min_amount: Decimal | None = None
    max_amount: Decimal | None = None
    search: str | None = Field(default=None, description="Search in description and merchant")
    is_reviewed: bool | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=200)
    sort_by: Literal["transaction_date", "amount", "merchant", "created_at"] = "transaction_date"
    sort_order: Literal["asc", "desc"] = "desc"


# ──────────────────────────── Budget ─────────────────────────────────────────


class BudgetBase(BaseSchema):
    category: TransactionCategory
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)
    amount_limit: Decimal = Field(gt=0)
    notes: str | None = None


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseSchema):
    amount_limit: Decimal | None = Field(default=None, gt=0)
    notes: str | None = None


class BudgetResponse(BudgetBase, TimestampSchema):
    id: UUID
    user_id: UUID


class BudgetStatusResponse(BaseSchema):
    """Budget vs. actual spending for a category."""

    budget: BudgetResponse
    spent_amount: Decimal = Decimal("0")
    remaining: Decimal = Decimal("0")
    transactions_count: int = 0
    is_over_budget: bool = False


# ──────────────────────────── Recurring Expense ──────────────────────────────


class RecurringExpenseBase(BaseSchema):
    name: str = Field(max_length=255)
    merchant: str | None = Field(default=None, max_length=255)
    category: TransactionCategory | None = None
    expected_amount: Decimal | None = Field(default=None, gt=0)
    billing_cycle: BillingCycle = BillingCycle.MONTHLY
    next_due_date: date | None = None
    is_active: bool = True
    auto_match: bool = True
    notes: str | None = None


class RecurringExpenseCreate(RecurringExpenseBase):
    pass


class RecurringExpenseUpdate(BaseSchema):
    name: str | None = Field(default=None, max_length=255)
    merchant: str | None = None
    category: TransactionCategory | None = None
    expected_amount: Decimal | None = Field(default=None, gt=0)
    billing_cycle: BillingCycle | None = None
    next_due_date: date | None = None
    last_seen_date: date | None = None
    is_active: bool | None = None
    auto_match: bool | None = None
    notes: str | None = None


class RecurringExpenseResponse(RecurringExpenseBase, TimestampSchema):
    id: UUID
    user_id: UUID
    last_seen_date: date | None = None


# ──────────────────────────── Stats & Import ─────────────────────────────────


class FinanceStatsResponse(BaseSchema):
    total_accounts: int = 0
    current_month_income: Decimal = Decimal("0")
    current_month_expenses: Decimal = Decimal("0")
    current_month_net: Decimal = Decimal("0")
    current_month_transactions: int = 0
    unreviewed_count: int = 0
    active_recurring_count: int = 0


class CSVImportRequest(BaseSchema):
    account_id: UUID | None = None
    csv_content: str = Field(description="Raw CSV content as string")
    date_column: str = Field(default="Date", description="Name of the date column in the CSV")
    description_column: str = Field(
        default="Description", description="Name of the description column"
    )
    amount_column: str = Field(default="Amount", description="Name of the amount column")
    date_format: str = Field(default="%m/%d/%Y", description="Python strftime date format string")


class CSVImportResponse(BaseSchema):
    imported: int = 0
    skipped_duplicates: int = 0
    errors: list[str] = Field(default_factory=list)
