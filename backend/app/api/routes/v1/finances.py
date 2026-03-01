"""Finance API routes.

Provides REST endpoints for managing financial accounts, transactions,
budgets, and recurring expenses.
"""

import logging
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.api.deps import CurrentUser, FinanceSvc
from app.db.models.finance import TransactionCategory, TransactionSource, TransactionType
from app.schemas.finance import (
    BudgetCreate,
    BudgetResponse,
    BudgetStatusResponse,
    BudgetUpdate,
    CSVImportRequest,
    CSVImportResponse,
    FinanceStatsResponse,
    FinancialAccountBalanceUpdate,
    FinancialAccountCreate,
    FinancialAccountResponse,
    FinancialAccountUpdate,
    RecurringExpenseCreate,
    RecurringExpenseResponse,
    RecurringExpenseUpdate,
    TransactionCreate,
    TransactionFilters,
    TransactionListResponse,
    TransactionResponse,
    TransactionUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ──────────────────────────── Accounts ───────────────────────────────────────


@router.get("/accounts", response_model=list[FinancialAccountResponse])
async def list_accounts(
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> list[FinancialAccountResponse]:
    accounts = await finance_service.list_accounts(current_user.id)
    return [FinancialAccountResponse.model_validate(a) for a in accounts]


@router.post("/accounts", response_model=FinancialAccountResponse, status_code=201)
async def create_account(
    data: FinancialAccountCreate,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> FinancialAccountResponse:
    account = await finance_service.create_account(current_user.id, data)
    return FinancialAccountResponse.model_validate(account)


@router.get("/accounts/{account_id}", response_model=FinancialAccountResponse)
async def get_account(
    account_id: UUID,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> FinancialAccountResponse:
    account = await finance_service.get_account(current_user.id, account_id)
    return FinancialAccountResponse.model_validate(account)


@router.patch("/accounts/{account_id}", response_model=FinancialAccountResponse)
async def update_account(
    account_id: UUID,
    data: FinancialAccountUpdate,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> FinancialAccountResponse:
    account = await finance_service.update_account(current_user.id, account_id, data)
    return FinancialAccountResponse.model_validate(account)


@router.delete("/accounts/{account_id}", status_code=204)
async def delete_account(
    account_id: UUID,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> None:
    await finance_service.delete_account(current_user.id, account_id)


@router.patch("/accounts/{account_id}/balance", response_model=FinancialAccountResponse)
async def update_account_balance(
    account_id: UUID,
    data: FinancialAccountBalanceUpdate,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> FinancialAccountResponse:
    account = await finance_service.update_balance(
        current_user.id, account_id, data.current_balance
    )
    return FinancialAccountResponse.model_validate(account)


# ──────────────────────────── Stats ──────────────────────────────────────────


@router.get("/stats", response_model=FinanceStatsResponse)
async def get_finance_stats(
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> FinanceStatsResponse:
    return await finance_service.get_stats(current_user.id)


# ──────────────────────────── Transactions ───────────────────────────────────


@router.get("/transactions", response_model=TransactionListResponse)
async def list_transactions(
    current_user: CurrentUser,
    finance_service: FinanceSvc,
    account_id: UUID | None = Query(None),
    category: TransactionCategory | None = Query(None),
    source: TransactionSource | None = Query(None),
    transaction_type: TransactionType | None = Query(None),
    date_from: str | None = Query(None, description="ISO date YYYY-MM-DD"),
    date_to: str | None = Query(None, description="ISO date YYYY-MM-DD"),
    min_amount: Decimal | None = Query(None),
    max_amount: Decimal | None = Query(None),
    search: str | None = Query(None),
    is_reviewed: bool | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort_by: str = Query("transaction_date"),
    sort_order: str = Query("desc"),
) -> TransactionListResponse:
    from datetime import date

    filters = TransactionFilters(
        account_id=account_id,
        category=category,
        source=source,
        transaction_type=transaction_type,
        date_from=date.fromisoformat(date_from) if date_from else None,
        date_to=date.fromisoformat(date_to) if date_to else None,
        min_amount=min_amount,
        max_amount=max_amount,
        search=search,
        is_reviewed=is_reviewed,
        page=page,
        page_size=page_size,
        sort_by=sort_by,  # type: ignore
        sort_order=sort_order,  # type: ignore
    )

    transactions, total = await finance_service.list_transactions(current_user.id, filters)
    return TransactionListResponse(
        transactions=[TransactionResponse.model_validate(t) for t in transactions],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total,
    )


@router.post("/transactions", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    data: TransactionCreate,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> TransactionResponse:
    tx = await finance_service.create_transaction(current_user.id, data)
    return TransactionResponse.model_validate(tx)


@router.post("/transactions/import-csv", response_model=CSVImportResponse)
async def import_transactions_csv(
    data: CSVImportRequest,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> CSVImportResponse:
    return await finance_service.import_csv(
        user_id=current_user.id,
        account_id=data.account_id,
        csv_content=data.csv_content,
        date_column=data.date_column,
        description_column=data.description_column,
        amount_column=data.amount_column,
        date_format=data.date_format,
    )


class CategorizeRequest(BaseModel):
    limit: int = 100
    account_id: UUID | None = None


class CategorizeResponse(BaseModel):
    categorized: int
    failed: int


@router.post("/transactions/categorize", response_model=CategorizeResponse)
async def categorize_transactions(
    data: CategorizeRequest,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> CategorizeResponse:
    categorized, failed = await finance_service.categorize_with_ai(
        current_user.id, limit=data.limit, account_id=data.account_id
    )
    return CategorizeResponse(categorized=categorized, failed=failed)


@router.get("/transactions/{tx_id}", response_model=TransactionResponse)
async def get_transaction(
    tx_id: UUID,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> TransactionResponse:
    tx = await finance_service.get_transaction(current_user.id, tx_id)
    return TransactionResponse.model_validate(tx)


@router.patch("/transactions/{tx_id}", response_model=TransactionResponse)
async def update_transaction(
    tx_id: UUID,
    data: TransactionUpdate,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> TransactionResponse:
    tx = await finance_service.update_transaction(current_user.id, tx_id, data)
    return TransactionResponse.model_validate(tx)


@router.delete("/transactions/{tx_id}", status_code=204)
async def delete_transaction(
    tx_id: UUID,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> None:
    await finance_service.delete_transaction(current_user.id, tx_id)


@router.post("/transactions/{tx_id}/review", response_model=TransactionResponse)
async def mark_transaction_reviewed(
    tx_id: UUID,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> TransactionResponse:
    tx = await finance_service.mark_reviewed(current_user.id, tx_id)
    return TransactionResponse.model_validate(tx)


# ──────────────────────────── Budgets ────────────────────────────────────────


@router.get("/budgets", response_model=list[BudgetResponse])
async def list_budgets(
    current_user: CurrentUser,
    finance_service: FinanceSvc,
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100),
) -> list[BudgetResponse]:
    budgets = await finance_service.get_budgets(current_user.id, month, year)
    return [BudgetResponse.model_validate(b) for b in budgets]


@router.get("/budgets/status", response_model=list[BudgetStatusResponse])
async def get_budget_status(
    current_user: CurrentUser,
    finance_service: FinanceSvc,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
) -> list[BudgetStatusResponse]:
    return await finance_service.get_budget_status(current_user.id, month, year)


@router.post("/budgets", response_model=BudgetResponse, status_code=201)
async def create_budget(
    data: BudgetCreate,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> BudgetResponse:
    budget = await finance_service.create_budget(current_user.id, data)
    return BudgetResponse.model_validate(budget)


@router.patch("/budgets/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: UUID,
    data: BudgetUpdate,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> BudgetResponse:
    budget = await finance_service.update_budget(current_user.id, budget_id, data)
    return BudgetResponse.model_validate(budget)


@router.delete("/budgets/{budget_id}", status_code=204)
async def delete_budget(
    budget_id: UUID,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> None:
    await finance_service.delete_budget(current_user.id, budget_id)


# ──────────────────────────── Recurring Expenses ─────────────────────────────


@router.get("/recurring", response_model=list[RecurringExpenseResponse])
async def list_recurring(
    current_user: CurrentUser,
    finance_service: FinanceSvc,
    active_only: bool = Query(True),
) -> list[RecurringExpenseResponse]:
    recurring = await finance_service.list_recurring(current_user.id, active_only=active_only)
    return [RecurringExpenseResponse.model_validate(r) for r in recurring]


@router.post("/recurring", response_model=RecurringExpenseResponse, status_code=201)
async def create_recurring(
    data: RecurringExpenseCreate,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> RecurringExpenseResponse:
    recurring = await finance_service.create_recurring(current_user.id, data)
    return RecurringExpenseResponse.model_validate(recurring)


@router.patch("/recurring/{recurring_id}", response_model=RecurringExpenseResponse)
async def update_recurring(
    recurring_id: UUID,
    data: RecurringExpenseUpdate,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> RecurringExpenseResponse:
    recurring = await finance_service.update_recurring(current_user.id, recurring_id, data)
    return RecurringExpenseResponse.model_validate(recurring)


@router.delete("/recurring/{recurring_id}", status_code=204)
async def delete_recurring(
    recurring_id: UUID,
    current_user: CurrentUser,
    finance_service: FinanceSvc,
) -> None:
    await finance_service.delete_recurring(current_user.id, recurring_id)
