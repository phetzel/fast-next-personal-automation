"""Finance service.

Contains business logic for financial accounts, transactions, budgets,
and recurring expenses. Uses finance repository for database access.
"""

import csv
import io
import logging
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AlreadyExistsError, NotFoundError, ValidationError
from app.db.models.finance import (
    Budget,
    FinancialAccount,
    RecurringExpense,
    Transaction,
    TransactionSource,
)
from app.repositories import finance_repo
from app.schemas.finance import (
    BudgetCreate,
    BudgetStatusResponse,
    BudgetUpdate,
    CSVImportResponse,
    FinancialAccountCreate,
    FinancialAccountUpdate,
    FinanceStatsResponse,
    RecurringExpenseCreate,
    RecurringExpenseUpdate,
    TransactionCreate,
    TransactionFilters,
    TransactionUpdate,
)

logger = logging.getLogger(__name__)


class FinanceService:
    """Service for finance-related business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ──────────────────── FinancialAccount ────────────────────────────────

    async def create_account(
        self, user_id: UUID, data: FinancialAccountCreate
    ) -> FinancialAccount:
        account = await finance_repo.create_account(self.db, user_id=user_id, **data.model_dump())
        return account

    async def get_account(self, user_id: UUID, account_id: UUID) -> FinancialAccount:
        account = await finance_repo.get_account_by_id_and_user(self.db, account_id, user_id)
        if not account:
            raise NotFoundError(message="Account not found", details={"account_id": str(account_id)})
        return account

    async def list_accounts(self, user_id: UUID) -> list[FinancialAccount]:
        return await finance_repo.get_accounts_by_user(self.db, user_id)

    async def update_account(
        self, user_id: UUID, account_id: UUID, data: FinancialAccountUpdate
    ) -> FinancialAccount:
        account = await self.get_account(user_id, account_id)
        update_data = data.model_dump(exclude_none=True)
        if not update_data:
            return account
        return await finance_repo.update_account(self.db, account=account, update_data=update_data)

    async def delete_account(self, user_id: UUID, account_id: UUID) -> None:
        account = await self.get_account(user_id, account_id)
        await finance_repo.delete_account(self.db, account.id, user_id)

    async def update_balance(
        self, user_id: UUID, account_id: UUID, balance: Decimal
    ) -> FinancialAccount:
        account = await self.get_account(user_id, account_id)
        return await finance_repo.update_account(
            self.db,
            account=account,
            update_data={
                "current_balance": balance,
                "balance_updated_at": datetime.utcnow(),
            },
        )

    # ──────────────────── Transaction ─────────────────────────────────────

    async def create_transaction(
        self, user_id: UUID, data: TransactionCreate
    ) -> Transaction:
        if data.account_id:
            await self.get_account(user_id, data.account_id)

        tx_data = data.model_dump()

        # Auto-match to a recurring expense if no explicit link and merchant is set
        if not tx_data.get("recurring_expense_id") and tx_data.get("merchant"):
            match = await finance_repo.find_matching_recurring(self.db, user_id, tx_data["merchant"])
            if match:
                tx_data["recurring_expense_id"] = match.id
                if match.last_seen_date is None or match.last_seen_date < data.transaction_date:
                    await finance_repo.update_recurring(
                        self.db,
                        recurring=match,
                        update_data={"last_seen_date": data.transaction_date},
                    )

        return await finance_repo.create_transaction(self.db, user_id=user_id, **tx_data)

    async def get_transaction(self, user_id: UUID, tx_id: UUID) -> Transaction:
        tx = await finance_repo.get_transaction_by_id_and_user(self.db, tx_id, user_id)
        if not tx:
            raise NotFoundError(message="Transaction not found", details={"tx_id": str(tx_id)})
        return tx

    async def list_transactions(
        self, user_id: UUID, filters: TransactionFilters | None = None
    ) -> tuple[list[Transaction], int]:
        if filters is None:
            filters = TransactionFilters()
        return await finance_repo.get_transactions_by_user(self.db, user_id, filters)

    async def update_transaction(
        self, user_id: UUID, tx_id: UUID, data: TransactionUpdate
    ) -> Transaction:
        tx = await self.get_transaction(user_id, tx_id)
        update_data = data.model_dump(exclude_none=True)
        if not update_data:
            return tx
        return await finance_repo.update_transaction(self.db, transaction=tx, update_data=update_data)

    async def delete_transaction(self, user_id: UUID, tx_id: UUID) -> None:
        await self.get_transaction(user_id, tx_id)
        await finance_repo.delete_transaction(self.db, tx_id, user_id)

    async def mark_reviewed(self, user_id: UUID, tx_id: UUID) -> Transaction:
        tx = await self.get_transaction(user_id, tx_id)
        return await finance_repo.update_transaction(
            self.db, transaction=tx, update_data={"is_reviewed": True}
        )

    async def ingest_from_email(
        self, user_id: UUID, parsed_transactions: list[dict[str, Any]]
    ) -> tuple[int, int]:
        """Ingest email-parsed transactions, deduplicating by raw_email_id.

        Returns (imported_count, skipped_count).
        """
        for tx in parsed_transactions:
            tx["source"] = TransactionSource.EMAIL_PARSED.value

        created, skipped = await finance_repo.create_bulk_transactions(
            self.db, user_id, parsed_transactions
        )
        return len(created), skipped

    async def import_csv(
        self,
        user_id: UUID,
        account_id: UUID | None,
        csv_content: str,
        date_column: str,
        description_column: str,
        amount_column: str,
        date_format: str,
    ) -> CSVImportResponse:
        """Parse and import transactions from CSV content."""
        if account_id:
            await self.get_account(user_id, account_id)

        errors: list[str] = []
        transactions_data: list[dict] = []

        try:
            reader = csv.DictReader(io.StringIO(csv_content))
        except Exception as e:
            raise ValidationError(message=f"Failed to parse CSV: {e}") from e

        for i, row in enumerate(reader, start=2):  # row 1 = header
            try:
                raw_date = row.get(date_column, "").strip()
                raw_amount = row.get(amount_column, "").strip()
                raw_desc = row.get(description_column, "").strip()

                if not raw_date or not raw_amount or not raw_desc:
                    errors.append(f"Row {i}: missing required field(s)")
                    continue

                tx_date = datetime.strptime(raw_date, date_format).date()

                # Handle amounts that may come as strings like "-$1,234.56"
                clean_amount = raw_amount.replace("$", "").replace(",", "").replace(" ", "")
                amount = Decimal(clean_amount)

            except (ValueError, InvalidOperation) as e:
                errors.append(f"Row {i}: {e}")
                continue

            transactions_data.append(
                {
                    "amount": amount,
                    "description": raw_desc,
                    "transaction_date": tx_date,
                    "transaction_type": "credit" if amount > 0 else "debit",
                    "source": TransactionSource.CSV_IMPORT.value,
                    "account_id": account_id,
                }
            )

        created, skipped = await finance_repo.create_bulk_transactions(
            self.db, user_id, transactions_data
        )
        return CSVImportResponse(imported=len(created), skipped_duplicates=skipped, errors=errors)

    async def categorize_with_ai(
        self, user_id: UUID, limit: int = 100, account_id: UUID | None = None
    ) -> tuple[int, int]:
        """AI-categorize uncategorized transactions using OpenAI.

        Returns (categorized_count, failed_count).
        """
        from app.core.config import settings
        from openai import AsyncOpenAI

        transactions = await finance_repo.get_uncategorized_transactions(
            self.db, user_id, limit=limit, account_id=account_id
        )
        if not transactions:
            return 0, 0

        # Import category values for the prompt
        from app.db.models.finance import TransactionCategory

        valid_categories = [c.value for c in TransactionCategory]
        categories_str = ", ".join(valid_categories)

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        categorized = 0
        failed = 0

        # Process in batches of 20
        batch_size = 20
        for i in range(0, len(transactions), batch_size):
            batch = transactions[i : i + batch_size]
            items = [
                {
                    "index": j,
                    "description": tx.description,
                    "merchant": tx.merchant or "",
                    "amount": float(tx.amount),
                }
                for j, tx in enumerate(batch)
            ]

            prompt = f"""Categorize each financial transaction into exactly one of these categories:
{categories_str}

Rules:
- Positive amounts are income (use income_* categories)
- Negative amounts are expenses
- Return a JSON array with objects: {{"index": <int>, "category": "<category>", "confidence": <0.0-1.0>}}
- Only use categories from the list above

Transactions:
{items}"""

            try:
                response = await client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0,
                )
                import json

                content = response.choices[0].message.content or "{}"
                result = json.loads(content)
                results = result.get("results", result) if isinstance(result, dict) else result
                if isinstance(results, dict):
                    results = list(results.values())

                for item in results:
                    idx = item.get("index")
                    if idx is None or idx >= len(batch):
                        continue
                    category = item.get("category", "").lower().replace("-", "_").replace(" ", "_")
                    confidence = float(item.get("confidence", 0.5))
                    if category in valid_categories:
                        await finance_repo.update_transaction(
                            self.db,
                            transaction=batch[idx],
                            update_data={"category": category, "category_confidence": confidence},
                        )
                        categorized += 1
                    else:
                        failed += 1

            except Exception as e:
                logger.warning("AI categorization batch failed: %s", e)
                failed += len(batch)

        return categorized, failed

    # ──────────────────── Budget ───────────────────────────────────────────

    async def create_budget(self, user_id: UUID, data: BudgetCreate) -> Budget:
        existing = await finance_repo.get_budget_by_category(
            self.db, user_id, data.category.value, data.month, data.year
        )
        if existing:
            raise AlreadyExistsError(
                message="Budget already exists for this category/month/year",
                details={"category": data.category.value, "month": data.month, "year": data.year},
            )
        budget_data = data.model_dump()
        budget_data["category"] = data.category.value
        return await finance_repo.create_budget(self.db, user_id=user_id, **budget_data)

    async def get_budgets(self, user_id: UUID, month: int, year: int) -> list[Budget]:
        return await finance_repo.get_budgets_by_user(self.db, user_id, month, year)

    async def get_budget_status(
        self, user_id: UUID, month: int, year: int
    ) -> list[BudgetStatusResponse]:
        budgets = await finance_repo.get_budgets_by_user(self.db, user_id, month, year)
        if not budgets:
            return []

        spending = await finance_repo.get_spending_by_category(self.db, user_id, month, year)

        results = []
        for budget in budgets:
            from app.schemas.finance import BudgetResponse

            budget_response = BudgetResponse.model_validate(budget)
            spent = spending.get(budget.category, Decimal("0"))
            remaining = budget.amount_limit - spent
            results.append(
                BudgetStatusResponse(
                    budget=budget_response,
                    spent_amount=spent,
                    remaining=remaining,
                    transactions_count=0,
                    is_over_budget=spent > budget.amount_limit,
                )
            )
        return results

    async def update_budget(
        self, user_id: UUID, budget_id: UUID, data: BudgetUpdate
    ) -> Budget:
        budget = await finance_repo.get_budget_by_id_and_user(self.db, budget_id, user_id)
        if not budget:
            raise NotFoundError(message="Budget not found", details={"budget_id": str(budget_id)})
        update_data = data.model_dump(exclude_none=True)
        if not update_data:
            return budget
        return await finance_repo.update_budget(self.db, budget=budget, update_data=update_data)

    async def delete_budget(self, user_id: UUID, budget_id: UUID) -> None:
        budget = await finance_repo.get_budget_by_id_and_user(self.db, budget_id, user_id)
        if not budget:
            raise NotFoundError(message="Budget not found", details={"budget_id": str(budget_id)})
        await finance_repo.delete_budget(self.db, budget_id, user_id)

    # ──────────────────── RecurringExpense ────────────────────────────────

    async def create_recurring(
        self, user_id: UUID, data: RecurringExpenseCreate
    ) -> RecurringExpense:
        re_data = data.model_dump()
        if data.category:
            re_data["category"] = data.category.value
        return await finance_repo.create_recurring(self.db, user_id=user_id, **re_data)

    async def list_recurring(
        self, user_id: UUID, active_only: bool = True
    ) -> list[RecurringExpense]:
        return await finance_repo.get_recurring_by_user(self.db, user_id, active_only=active_only)

    async def update_recurring(
        self, user_id: UUID, recurring_id: UUID, data: RecurringExpenseUpdate
    ) -> RecurringExpense:
        recurring = await finance_repo.get_recurring_by_id_and_user(self.db, recurring_id, user_id)
        if not recurring:
            raise NotFoundError(
                message="Recurring expense not found", details={"recurring_id": str(recurring_id)}
            )
        update_data = data.model_dump(exclude_none=True)
        if "category" in update_data and update_data["category"] is not None:
            update_data["category"] = update_data["category"].value
        if not update_data:
            return recurring
        return await finance_repo.update_recurring(
            self.db, recurring=recurring, update_data=update_data
        )

    async def delete_recurring(self, user_id: UUID, recurring_id: UUID) -> None:
        recurring = await finance_repo.get_recurring_by_id_and_user(self.db, recurring_id, user_id)
        if not recurring:
            raise NotFoundError(
                message="Recurring expense not found", details={"recurring_id": str(recurring_id)}
            )
        await finance_repo.delete_recurring(self.db, recurring_id, user_id)

    # ──────────────────── Stats ────────────────────────────────────────────

    async def get_stats(self, user_id: UUID) -> FinanceStatsResponse:
        today = date.today()
        accounts = await finance_repo.get_accounts_by_user(self.db, user_id)
        income, expenses, tx_count = await finance_repo.get_monthly_summary(
            self.db, user_id, today.month, today.year
        )
        unreviewed = await finance_repo.get_unreviewed_count(self.db, user_id)
        active_recurring = await finance_repo.get_active_recurring_count(self.db, user_id)

        return FinanceStatsResponse(
            total_accounts=len(accounts),
            current_month_income=income,
            current_month_expenses=expenses,
            current_month_net=income - expenses,
            current_month_transactions=tx_count,
            unreviewed_count=unreviewed,
            active_recurring_count=active_recurring,
        )
