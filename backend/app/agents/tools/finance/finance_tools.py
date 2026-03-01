"""Finance tools for the Finance area agent.

Provides natural language access to financial data: transactions, accounts,
spending summaries, budget status, and recurring expenses.
"""

from datetime import date
from uuid import UUID

from pydantic_ai import RunContext
from pydantic_ai.toolsets import FunctionToolset

from app.repositories import finance_repo
from app.schemas.finance import TransactionFilters


def _get_db_and_user(ctx: RunContext) -> tuple:
    if not ctx.deps.db:
        return None, None, "Database session not available"
    if not ctx.deps.user_id:
        return None, None, "User not authenticated"
    try:
        user_id = UUID(ctx.deps.user_id)
    except ValueError:
        return None, None, "Invalid user ID"
    return ctx.deps.db, user_id, None


finance_toolset = FunctionToolset()


@finance_toolset.tool
async def list_transactions(
    ctx: RunContext,
    category: str | None = None,
    account_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
    is_reviewed: bool | None = None,
    page: int = 1,
    page_size: int = 30,
) -> dict:
    """List the user's financial transactions with optional filters.

    Args:
        category: Filter by category (e.g. "dining", "groceries", "subscriptions")
        account_id: Filter by account UUID string
        date_from: Start date filter in YYYY-MM-DD format
        date_to: End date filter in YYYY-MM-DD format
        search: Search in description and merchant name
        is_reviewed: Filter by review status (True = reviewed, False = needs review)
        page: Page number (starts at 1)
        page_size: Results per page (max 100)

    Returns:
        Dictionary with transactions list, total count, and pagination info
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    try:
        filters = TransactionFilters(
            category=category,
            account_id=UUID(account_id) if account_id else None,
            date_from=date.fromisoformat(date_from) if date_from else None,
            date_to=date.fromisoformat(date_to) if date_to else None,
            search=search,
            is_reviewed=is_reviewed,
            page=page,
            page_size=min(100, max(1, page_size)),
        )
    except (ValueError, TypeError) as e:
        return {"success": False, "error": f"Invalid filter parameter: {e}"}

    transactions, total = await finance_repo.get_transactions_by_user(db, user_id, filters)

    return {
        "success": True,
        "transactions": [
            {
                "id": str(t.id),
                "amount": float(t.amount),
                "description": t.description,
                "merchant": t.merchant,
                "category": t.category,
                "transaction_date": t.transaction_date.isoformat(),
                "transaction_type": t.transaction_type,
                "source": t.source,
                "is_reviewed": t.is_reviewed,
                "account_id": str(t.account_id) if t.account_id else None,
            }
            for t in transactions
        ],
        "total": total,
        "page": page,
        "has_more": total > page * page_size,
    }


@finance_toolset.tool
async def get_spending_summary(
    ctx: RunContext,
    month: int | None = None,
    year: int | None = None,
) -> dict:
    """Get spending breakdown by category for a given month.

    If month/year are not provided, defaults to the current month.

    Args:
        month: Month number (1-12). Defaults to current month.
        year: Year (e.g. 2026). Defaults to current year.

    Returns:
        Dictionary with spending totals per category and overall summary
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    today = date.today()
    month = month or today.month
    year = year or today.year

    try:
        spending = await finance_repo.get_spending_by_category(db, user_id, month, year)
        income, expenses, tx_count = await finance_repo.get_monthly_summary(db, user_id, month, year)
    except Exception as e:
        return {"success": False, "error": str(e)}

    return {
        "success": True,
        "period": f"{year}-{month:02d}",
        "total_income": float(income),
        "total_expenses": float(expenses),
        "net": float(income - expenses),
        "transaction_count": tx_count,
        "spending_by_category": {k: float(v) for k, v in sorted(spending.items(), key=lambda x: -x[1])},
    }


@finance_toolset.tool
async def get_account_summary(ctx: RunContext) -> dict:
    """Get a summary of all financial accounts including balances.

    Returns:
        List of accounts with their current balances and metadata
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    accounts = await finance_repo.get_accounts_by_user(db, user_id)

    return {
        "success": True,
        "accounts": [
            {
                "id": str(a.id),
                "name": a.name,
                "institution": a.institution,
                "account_type": a.account_type,
                "last_four": a.last_four,
                "current_balance": float(a.current_balance) if a.current_balance is not None else None,
                "balance_updated_at": a.balance_updated_at.isoformat() if a.balance_updated_at else None,
                "is_active": a.is_active,
            }
            for a in accounts
        ],
        "total_accounts": len(accounts),
    }


@finance_toolset.tool
async def get_budget_status(
    ctx: RunContext,
    month: int | None = None,
    year: int | None = None,
) -> dict:
    """Get budget vs. actual spending for the given month.

    Shows how much has been spent against each budget category limit.
    If month/year not provided, defaults to current month.

    Args:
        month: Month number (1-12). Defaults to current month.
        year: Year (e.g. 2026). Defaults to current year.

    Returns:
        List of budget categories with limit, spent, remaining, and over-budget flag
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    today = date.today()
    month = month or today.month
    year = year or today.year

    budgets = await finance_repo.get_budgets_by_user(db, user_id, month, year)
    if not budgets:
        return {
            "success": True,
            "period": f"{year}-{month:02d}",
            "message": "No budgets set for this period.",
            "budget_status": [],
        }

    spending = await finance_repo.get_spending_by_category(db, user_id, month, year)

    budget_status = []
    for b in budgets:
        spent = float(spending.get(b.category, 0))
        limit = float(b.amount_limit)
        budget_status.append(
            {
                "category": b.category,
                "limit": limit,
                "spent": spent,
                "remaining": limit - spent,
                "is_over_budget": spent > limit,
                "percent_used": round((spent / limit * 100) if limit > 0 else 0, 1),
            }
        )

    return {
        "success": True,
        "period": f"{year}-{month:02d}",
        "budget_status": sorted(budget_status, key=lambda x: -x["spent"]),
    }


@finance_toolset.tool
async def list_recurring_expenses(ctx: RunContext, active_only: bool = True) -> dict:
    """List recurring expenses and subscriptions.

    Args:
        active_only: If True, only return active recurring expenses. Default True.

    Returns:
        List of recurring expenses with billing cycle and expected amounts
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    recurring = await finance_repo.get_recurring_by_user(db, user_id, active_only=active_only)

    return {
        "success": True,
        "recurring_expenses": [
            {
                "id": str(r.id),
                "name": r.name,
                "merchant": r.merchant,
                "category": r.category,
                "expected_amount": float(r.expected_amount) if r.expected_amount is not None else None,
                "billing_cycle": r.billing_cycle,
                "next_due_date": r.next_due_date.isoformat() if r.next_due_date else None,
                "last_seen_date": r.last_seen_date.isoformat() if r.last_seen_date else None,
                "is_active": r.is_active,
            }
            for r in recurring
        ],
        "total": len(recurring),
    }


@finance_toolset.tool
async def create_transaction(
    ctx: RunContext,
    amount: float,
    description: str,
    transaction_date: str,
    category: str | None = None,
    merchant: str | None = None,
    account_id: str | None = None,
    notes: str | None = None,
) -> dict:
    """Create a new manual financial transaction.

    Use this when the user wants to log a transaction manually.
    Amount should be negative for expenses/debits, positive for income/credits.

    Args:
        amount: Transaction amount. Negative = expense, positive = income/refund
        description: Brief description of the transaction
        transaction_date: Date in YYYY-MM-DD format
        category: Optional category (e.g. "dining", "groceries", "income_salary")
        merchant: Optional merchant/payee name
        account_id: Optional account UUID to associate with
        notes: Optional notes

    Returns:
        Created transaction details or error
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    from decimal import Decimal

    from app.db.models.finance import TransactionSource, TransactionType
    from app.repositories import finance_repo as repo
    from app.schemas.finance import TransactionCreate

    try:
        tx_date = date.fromisoformat(transaction_date)
    except ValueError:
        return {"success": False, "error": f"Invalid date format: {transaction_date}. Use YYYY-MM-DD."}

    try:
        data = TransactionCreate(
            amount=Decimal(str(amount)),
            description=description,
            transaction_date=tx_date,
            merchant=merchant,
            category=category,
            account_id=UUID(account_id) if account_id else None,
            source=TransactionSource.MANUAL,
            transaction_type=TransactionType.CREDIT if amount > 0 else TransactionType.DEBIT,
            notes=notes,
        )
    except Exception as e:
        return {"success": False, "error": f"Invalid transaction data: {e}"}

    tx_data = data.model_dump()
    tx = await repo.create_transaction(db, user_id=user_id, **tx_data)

    return {
        "success": True,
        "message": f"Transaction created: {description} for ${abs(amount):.2f}",
        "transaction_id": str(tx.id),
    }


@finance_toolset.tool
async def update_transaction_category(
    ctx: RunContext,
    transaction_id: str,
    category: str,
    notes: str | None = None,
) -> dict:
    """Update the category (and optionally notes) of a transaction.

    Use this when the user wants to re-categorize a transaction or correct
    an AI-assigned category.

    Args:
        transaction_id: UUID of the transaction to update
        category: New category value (e.g. "dining", "groceries", "subscriptions")
        notes: Optional notes to add

    Returns:
        Success confirmation or error
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    try:
        tx_uuid = UUID(transaction_id)
    except ValueError:
        return {"success": False, "error": f"Invalid transaction ID: {transaction_id}"}

    tx = await finance_repo.get_transaction_by_id_and_user(db, tx_uuid, user_id)
    if not tx:
        return {"success": False, "error": "Transaction not found"}

    from app.db.models.finance import TransactionCategory

    valid = [c.value for c in TransactionCategory]
    if category not in valid:
        return {
            "success": False,
            "error": f"Invalid category '{category}'. Valid options: {', '.join(valid)}",
        }

    update_data: dict = {"category": category, "category_confidence": 1.0}
    if notes is not None:
        update_data["notes"] = notes

    await finance_repo.update_transaction(db, transaction=tx, update_data=update_data)

    return {
        "success": True,
        "message": f"Transaction '{tx.description}' categorized as '{category}'",
    }
