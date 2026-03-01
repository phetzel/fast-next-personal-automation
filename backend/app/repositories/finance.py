"""Finance repository (PostgreSQL async).

Contains database operations for FinancialAccount, Transaction, Budget,
and RecurringExpense entities. Business logic lives in FinanceService.
"""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.finance import Budget, FinancialAccount, RecurringExpense, Transaction
from app.schemas.finance import TransactionFilters


# ──────────────────────────── FinancialAccount ───────────────────────────────


async def get_account_by_id(db: AsyncSession, account_id: UUID) -> FinancialAccount | None:
    return await db.get(FinancialAccount, account_id)


async def get_account_by_id_and_user(
    db: AsyncSession, account_id: UUID, user_id: UUID
) -> FinancialAccount | None:
    result = await db.execute(
        select(FinancialAccount).where(
            FinancialAccount.id == account_id, FinancialAccount.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def get_accounts_by_user(db: AsyncSession, user_id: UUID) -> list[FinancialAccount]:
    result = await db.execute(
        select(FinancialAccount)
        .where(FinancialAccount.user_id == user_id)
        .order_by(FinancialAccount.created_at.asc())
    )
    return list(result.scalars().all())


async def create_account(db: AsyncSession, *, user_id: UUID, **kwargs) -> FinancialAccount:
    account = FinancialAccount(user_id=user_id, **kwargs)
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return account


async def update_account(
    db: AsyncSession, *, account: FinancialAccount, update_data: dict
) -> FinancialAccount:
    for field, value in update_data.items():
        setattr(account, field, value)
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return account


async def delete_account(db: AsyncSession, account_id: UUID, user_id: UUID) -> FinancialAccount | None:
    account = await get_account_by_id_and_user(db, account_id, user_id)
    if account:
        await db.delete(account)
        await db.flush()
    return account


# ──────────────────────────── Transaction ────────────────────────────────────


async def get_transaction_by_id(db: AsyncSession, tx_id: UUID) -> Transaction | None:
    return await db.get(Transaction, tx_id)


async def get_transaction_by_id_and_user(
    db: AsyncSession, tx_id: UUID, user_id: UUID
) -> Transaction | None:
    result = await db.execute(
        select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_by_raw_email_id(
    db: AsyncSession, user_id: UUID, raw_email_id: str
) -> Transaction | None:
    """Check for existing email-parsed transaction (dedup check)."""
    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user_id, Transaction.raw_email_id == raw_email_id
        )
    )
    return result.scalar_one_or_none()


def _apply_transaction_filters(
    query: Select, user_id: UUID, filters: TransactionFilters
) -> Select:
    query = query.where(Transaction.user_id == user_id)

    if filters.account_id:
        query = query.where(Transaction.account_id == filters.account_id)
    if filters.category:
        query = query.where(Transaction.category == filters.category.value)
    if filters.source:
        query = query.where(Transaction.source == filters.source.value)
    if filters.transaction_type:
        query = query.where(Transaction.transaction_type == filters.transaction_type.value)
    if filters.date_from:
        query = query.where(Transaction.transaction_date >= filters.date_from)
    if filters.date_to:
        query = query.where(Transaction.transaction_date <= filters.date_to)
    if filters.min_amount is not None:
        query = query.where(Transaction.amount >= filters.min_amount)
    if filters.max_amount is not None:
        query = query.where(Transaction.amount <= filters.max_amount)
    if filters.is_reviewed is not None:
        query = query.where(Transaction.is_reviewed == filters.is_reviewed)
    if filters.search:
        term = f"%{filters.search}%"
        query = query.where(
            or_(
                Transaction.description.ilike(term),
                Transaction.merchant.ilike(term),
            )
        )
    return query


def _apply_transaction_sorting(query: Select, filters: TransactionFilters) -> Select:
    sort_column = {
        "transaction_date": Transaction.transaction_date,
        "amount": Transaction.amount,
        "merchant": Transaction.merchant,
        "created_at": Transaction.created_at,
    }.get(filters.sort_by, Transaction.transaction_date)

    if filters.sort_order == "asc":
        return query.order_by(sort_column.asc().nullslast())
    return query.order_by(sort_column.desc().nullsfirst())


async def get_transactions_by_user(
    db: AsyncSession, user_id: UUID, filters: TransactionFilters
) -> tuple[list[Transaction], int]:
    base_query = select(Transaction)
    base_query = _apply_transaction_filters(base_query, user_id, filters)

    count_query = select(func.count()).select_from(base_query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    data_query = _apply_transaction_sorting(base_query, filters)
    offset = (filters.page - 1) * filters.page_size
    data_query = data_query.offset(offset).limit(filters.page_size)

    result = await db.execute(data_query)
    return list(result.scalars().all()), total


async def create_transaction(db: AsyncSession, *, user_id: UUID, **kwargs) -> Transaction:
    tx = Transaction(user_id=user_id, **kwargs)
    db.add(tx)
    await db.flush()
    await db.refresh(tx)
    return tx


async def create_bulk_transactions(
    db: AsyncSession, user_id: UUID, transactions_data: list[dict]
) -> tuple[list[Transaction], int]:
    """Create multiple transactions, skipping email-ID duplicates.

    Returns:
        (created_list, skipped_count)
    """
    created: list[Transaction] = []
    skipped = 0

    for tx_data in transactions_data:
        raw_email_id = tx_data.get("raw_email_id")
        if raw_email_id:
            existing = await get_by_raw_email_id(db, user_id, raw_email_id)
            if existing:
                skipped += 1
                continue

        tx = Transaction(user_id=user_id, **tx_data)
        db.add(tx)
        created.append(tx)

    if created:
        await db.flush()
        for tx in created:
            await db.refresh(tx)

    return created, skipped


async def update_transaction(
    db: AsyncSession, *, transaction: Transaction, update_data: dict
) -> Transaction:
    for field, value in update_data.items():
        setattr(transaction, field, value)
    db.add(transaction)
    await db.flush()
    await db.refresh(transaction)
    return transaction


async def delete_transaction(db: AsyncSession, tx_id: UUID, user_id: UUID) -> Transaction | None:
    tx = await get_transaction_by_id_and_user(db, tx_id, user_id)
    if tx:
        await db.delete(tx)
        await db.flush()
    return tx


async def get_spending_by_category(
    db: AsyncSession, user_id: UUID, month: int, year: int
) -> dict[str, Decimal]:
    """Return total spending (negative amounts) grouped by category for a given month."""
    from calendar import monthrange

    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])

    result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label("total"))
        .where(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
            Transaction.amount < 0,  # expenses only
        )
        .group_by(Transaction.category)
    )
    # Return absolute values (spending is stored as negative)
    return {row.category or "other": abs(row.total) for row in result}


async def get_monthly_summary(
    db: AsyncSession, user_id: UUID, month: int, year: int
) -> tuple[Decimal, Decimal, int]:
    """Return (total_income, total_expenses, transaction_count) for a month."""
    from calendar import monthrange

    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])

    result = await db.execute(
        select(
            func.sum(Transaction.amount).filter(Transaction.amount > 0).label("income"),
            func.sum(Transaction.amount).filter(Transaction.amount < 0).label("expenses"),
            func.count(Transaction.id).label("count"),
        ).where(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
        )
    )
    row = result.one()
    income = row.income or Decimal("0")
    expenses = abs(row.expenses or Decimal("0"))
    count = row.count or 0
    return income, expenses, count


async def get_uncategorized_transactions(
    db: AsyncSession, user_id: UUID, limit: int = 100, account_id: UUID | None = None
) -> list[Transaction]:
    query = select(Transaction).where(
        Transaction.user_id == user_id,
        Transaction.category.is_(None),
    )
    if account_id:
        query = query.where(Transaction.account_id == account_id)
    query = query.order_by(Transaction.transaction_date.desc()).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_unreviewed_count(db: AsyncSession, user_id: UUID) -> int:
    result = await db.execute(
        select(func.count(Transaction.id)).where(
            Transaction.user_id == user_id, Transaction.is_reviewed == False  # noqa: E712
        )
    )
    return result.scalar() or 0


# ──────────────────────────── Budget ─────────────────────────────────────────


async def get_budget_by_id_and_user(
    db: AsyncSession, budget_id: UUID, user_id: UUID
) -> Budget | None:
    result = await db.execute(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_budgets_by_user(
    db: AsyncSession, user_id: UUID, month: int, year: int
) -> list[Budget]:
    result = await db.execute(
        select(Budget)
        .where(Budget.user_id == user_id, Budget.month == month, Budget.year == year)
        .order_by(Budget.category.asc())
    )
    return list(result.scalars().all())


async def get_budget_by_category(
    db: AsyncSession, user_id: UUID, category: str, month: int, year: int
) -> Budget | None:
    result = await db.execute(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.category == category,
            Budget.month == month,
            Budget.year == year,
        )
    )
    return result.scalar_one_or_none()


async def create_budget(db: AsyncSession, *, user_id: UUID, **kwargs) -> Budget:
    budget = Budget(user_id=user_id, **kwargs)
    db.add(budget)
    await db.flush()
    await db.refresh(budget)
    return budget


async def update_budget(db: AsyncSession, *, budget: Budget, update_data: dict) -> Budget:
    for field, value in update_data.items():
        setattr(budget, field, value)
    db.add(budget)
    await db.flush()
    await db.refresh(budget)
    return budget


async def delete_budget(db: AsyncSession, budget_id: UUID, user_id: UUID) -> Budget | None:
    budget = await get_budget_by_id_and_user(db, budget_id, user_id)
    if budget:
        await db.delete(budget)
        await db.flush()
    return budget


# ──────────────────────────── RecurringExpense ───────────────────────────────


async def get_recurring_by_id_and_user(
    db: AsyncSession, recurring_id: UUID, user_id: UUID
) -> RecurringExpense | None:
    result = await db.execute(
        select(RecurringExpense).where(
            RecurringExpense.id == recurring_id, RecurringExpense.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def get_recurring_by_user(
    db: AsyncSession, user_id: UUID, active_only: bool = True
) -> list[RecurringExpense]:
    query = select(RecurringExpense).where(RecurringExpense.user_id == user_id)
    if active_only:
        query = query.where(RecurringExpense.is_active == True)  # noqa: E712
    query = query.order_by(RecurringExpense.name.asc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_recurring(
    db: AsyncSession, *, user_id: UUID, **kwargs
) -> RecurringExpense:
    recurring = RecurringExpense(user_id=user_id, **kwargs)
    db.add(recurring)
    await db.flush()
    await db.refresh(recurring)
    return recurring


async def update_recurring(
    db: AsyncSession, *, recurring: RecurringExpense, update_data: dict
) -> RecurringExpense:
    for field, value in update_data.items():
        setattr(recurring, field, value)
    db.add(recurring)
    await db.flush()
    await db.refresh(recurring)
    return recurring


async def delete_recurring(
    db: AsyncSession, recurring_id: UUID, user_id: UUID
) -> RecurringExpense | None:
    recurring = await get_recurring_by_id_and_user(db, recurring_id, user_id)
    if recurring:
        await db.delete(recurring)
        await db.flush()
    return recurring


async def find_matching_recurring(
    db: AsyncSession, user_id: UUID, merchant: str
) -> RecurringExpense | None:
    """Find an active recurring expense matching the given merchant name (case-insensitive)."""
    result = await db.execute(
        select(RecurringExpense).where(
            RecurringExpense.user_id == user_id,
            RecurringExpense.is_active == True,  # noqa: E712
            RecurringExpense.auto_match == True,  # noqa: E712
            RecurringExpense.merchant.ilike(f"%{merchant}%"),
        )
    )
    return result.scalar_one_or_none()


async def get_active_recurring_count(db: AsyncSession, user_id: UUID) -> int:
    result = await db.execute(
        select(func.count(RecurringExpense.id)).where(
            RecurringExpense.user_id == user_id,
            RecurringExpense.is_active == True,  # noqa: E712
        )
    )
    return result.scalar() or 0
