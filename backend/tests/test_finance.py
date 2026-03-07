"""Tests for finance service, repository helpers, and scheduled worker task."""

from datetime import UTC, date
from decimal import Decimal
from unittest.mock import AsyncMock, call, patch
from uuid import uuid4

import pytest

from app.core.exceptions import NotFoundError, ValidationError
from app.schemas.finance import (
    BudgetCreate,
    FinancialAccountCreate,
    FinancialAccountUpdate,
    RecurringExpenseCreate,
    RecurringExpenseUpdate,
)
from app.services.finance_service import FinanceService
from app.utils.billing_cycles import advance_billing_cycle

# ──────────────────────────── Billing cycle helper ───────────────────────────


class TestAdvanceBillingCycle:
    def test_weekly(self):
        d = date(2026, 3, 1)
        assert advance_billing_cycle(d, "weekly") == date(2026, 3, 8)

    def test_biweekly(self):
        d = date(2026, 3, 1)
        assert advance_billing_cycle(d, "biweekly") == date(2026, 3, 15)

    def test_monthly(self):
        d = date(2026, 1, 31)
        # Feb doesn't have 31 days — should clamp to 28
        assert advance_billing_cycle(d, "monthly") == date(2026, 2, 28)

    def test_monthly_normal(self):
        d = date(2026, 3, 15)
        assert advance_billing_cycle(d, "monthly") == date(2026, 4, 15)

    def test_quarterly(self):
        d = date(2026, 1, 15)
        assert advance_billing_cycle(d, "quarterly") == date(2026, 4, 15)

    def test_annual(self):
        d = date(2026, 3, 2)
        assert advance_billing_cycle(d, "annual") == date(2027, 3, 2)

    def test_annual_leap_day(self):
        # Feb 29 leap day — advances to Feb 28 on non-leap year
        d = date(2024, 2, 29)
        assert advance_billing_cycle(d, "annual") == date(2025, 2, 28)


# ──────────────────────────── FinanceService ─────────────────────────────────


class MockAccount:
    def __init__(
        self,
        account_id=None,
        user_id=None,
        current_balance=None,
        name="Test Account",
        is_default=False,
        is_active=True,
    ):
        self.id = account_id or uuid4()
        self.user_id = user_id or uuid4()
        self.current_balance = current_balance
        self.name = name
        self.institution = None
        self.is_default = is_default
        self.is_active = is_active


class MockRecurring:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id", uuid4())
        self.user_id = kwargs.get("user_id", uuid4())
        self.name = kwargs.get("name", "Netflix")
        self.merchant = kwargs.get("merchant", "NETFLIX")
        self.category = kwargs.get("category", "subscriptions")
        self.expected_amount = kwargs.get("expected_amount", Decimal("15.99"))
        self.billing_cycle = kwargs.get("billing_cycle", "monthly")
        self.next_due_date = kwargs.get("next_due_date", date(2026, 3, 1))
        self.last_seen_date = kwargs.get("last_seen_date")
        self.is_active = kwargs.get("is_active", True)
        self.auto_match = kwargs.get("auto_match", True)
        self.notes = kwargs.get("notes")
        self.account_id = kwargs.get("account_id")


class MockBudget:
    def __init__(self, **kwargs):
        from datetime import datetime

        self.id = kwargs.get("id", uuid4())
        self.user_id = kwargs.get("user_id", uuid4())
        self.category = kwargs.get("category")
        self.month = kwargs.get("month", 3)
        self.year = kwargs.get("year", 2026)
        self.amount_limit = kwargs.get("amount_limit", Decimal("500.00"))
        self.notes = kwargs.get("notes")
        self.created_at = datetime.now(UTC)
        self.updated_at = None


class TestFinanceServiceRecurring:
    @pytest.fixture
    def mock_db(self) -> AsyncMock:
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_db: AsyncMock) -> FinanceService:
        return FinanceService(mock_db)

    @pytest.mark.anyio
    async def test_create_recurring_without_account(self, service: FinanceService):
        """Creating a recurring expense with no account_id should not validate account."""
        data = RecurringExpenseCreate(
            name="Netflix",
            billing_cycle="monthly",
            expected_amount=Decimal("15.99"),
        )
        mock_recurring = MockRecurring()

        with patch("app.services.finance_service.finance_repo") as mock_repo:
            mock_repo.create_recurring = AsyncMock(return_value=mock_recurring)

            result = await service.create_recurring(uuid4(), data)

            assert result == mock_recurring
            mock_repo.create_recurring.assert_called_once()

    @pytest.mark.anyio
    async def test_create_recurring_validates_account_ownership(self, service: FinanceService):
        """Creating a recurring expense with account_id should verify account belongs to user."""
        user_id = uuid4()
        account_id = uuid4()
        data = RecurringExpenseCreate(
            name="Netflix",
            billing_cycle="monthly",
            expected_amount=Decimal("15.99"),
            account_id=account_id,
        )

        with patch("app.services.finance_service.finance_repo") as mock_repo:
            # Account not found — should raise NotFoundError
            mock_repo.get_account_by_id_and_user = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError):
                await service.create_recurring(user_id, data)

    @pytest.mark.anyio
    async def test_create_recurring_with_valid_account(self, service: FinanceService):
        """Creating a recurring expense with a valid owned account_id should succeed."""
        user_id = uuid4()
        mock_account = MockAccount(user_id=user_id)
        data = RecurringExpenseCreate(
            name="Netflix",
            billing_cycle="monthly",
            expected_amount=Decimal("15.99"),
            account_id=mock_account.id,
        )
        mock_recurring = MockRecurring(account_id=mock_account.id)

        with patch("app.services.finance_service.finance_repo") as mock_repo:
            mock_repo.get_account_by_id_and_user = AsyncMock(return_value=mock_account)
            mock_repo.create_recurring = AsyncMock(return_value=mock_recurring)

            result = await service.create_recurring(user_id, data)

            assert result == mock_recurring
            mock_repo.get_account_by_id_and_user.assert_called_once()


class TestFinanceServiceAccounts:
    @pytest.fixture
    def mock_db(self) -> AsyncMock:
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_db: AsyncMock) -> FinanceService:
        return FinanceService(mock_db)

    @pytest.mark.anyio
    async def test_create_first_account_becomes_default(self, service: FinanceService):
        user_id = uuid4()
        created_account = MockAccount(user_id=user_id, is_default=True)
        data = FinancialAccountCreate(name="Checking")

        with patch("app.services.finance_service.finance_repo") as mock_repo:
            mock_repo.get_accounts_by_user = AsyncMock(return_value=[])
            mock_repo.create_account = AsyncMock(return_value=created_account)
            mock_repo.clear_default_account = AsyncMock()

            result = await service.create_account(user_id, data)

            assert result == created_account
            mock_repo.create_account.assert_called_once()
            assert mock_repo.create_account.await_args.kwargs["is_default"] is True
            mock_repo.clear_default_account.assert_called_once()

    @pytest.mark.anyio
    async def test_create_explicit_default_clears_existing_default_before_create(
        self, service: FinanceService
    ):
        user_id = uuid4()
        existing_default = MockAccount(user_id=user_id, is_default=True)
        created_account = MockAccount(user_id=user_id, is_default=True, name="Savings")
        data = FinancialAccountCreate(name="Savings", is_default=True)

        with patch("app.services.finance_service.finance_repo") as mock_repo:
            mock_repo.get_accounts_by_user = AsyncMock(return_value=[existing_default])
            mock_repo.clear_default_account = AsyncMock()
            mock_repo.create_account = AsyncMock(return_value=created_account)

            result = await service.create_account(user_id, data)

            assert result == created_account
            assert mock_repo.mock_calls[:3] == [
                call.get_accounts_by_user(service.db, user_id),
                call.clear_default_account(service.db, user_id),
                call.create_account(
                    service.db,
                    user_id=user_id,
                    name="Savings",
                    institution=None,
                    account_type="checking",
                    last_four=None,
                    currency="USD",
                    is_default=True,
                    is_active=True,
                    notes=None,
                ),
            ]

    @pytest.mark.anyio
    async def test_update_default_account_requires_active_status(self, service: FinanceService):
        user_id = uuid4()
        account = MockAccount(user_id=user_id, is_default=False, is_active=True)
        data = FinancialAccountUpdate(is_default=True, is_active=False)

        with (
            patch.object(service, "get_account", AsyncMock(return_value=account)),
            pytest.raises(ValidationError),
        ):
            await service.update_account(user_id, account.id, data)

    @pytest.mark.anyio
    async def test_promoting_account_to_default_uses_set_default_account(
        self, service: FinanceService
    ):
        user_id = uuid4()
        account = MockAccount(user_id=user_id, is_default=False, is_active=True)
        promoted_account = MockAccount(
            account_id=account.id, user_id=user_id, is_default=True, is_active=True
        )
        data = FinancialAccountUpdate(name="Updated", is_default=True)

        with (
            patch.object(service, "get_account", AsyncMock(return_value=account)),
            patch("app.services.finance_service.finance_repo") as mock_repo,
        ):
            mock_repo.update_account = AsyncMock(return_value=account)
            mock_repo.set_default_account = AsyncMock(return_value=promoted_account)

            result = await service.update_account(user_id, account.id, data)

            assert result == promoted_account
            mock_repo.update_account.assert_called_once_with(
                service.db, account=account, update_data={"name": "Updated"}
            )
            mock_repo.set_default_account.assert_called_once_with(service.db, user_id, account.id)

    @pytest.mark.anyio
    async def test_deleting_default_account_promotes_replacement(self, service: FinanceService):
        user_id = uuid4()
        default_account = MockAccount(user_id=user_id, is_default=True)
        replacement = MockAccount(user_id=user_id)

        with (
            patch.object(service, "get_account", AsyncMock(return_value=default_account)),
            patch("app.services.finance_service.finance_repo") as mock_repo,
        ):
            mock_repo.delete_account = AsyncMock(return_value=default_account)
            mock_repo.get_first_active_account_by_user = AsyncMock(return_value=replacement)
            mock_repo.set_default_account = AsyncMock(return_value=replacement)

            await service.delete_account(user_id, default_account.id)

            mock_repo.delete_account.assert_called_once()
            mock_repo.get_first_active_account_by_user.assert_called_once_with(service.db, user_id)
            mock_repo.set_default_account.assert_called_once_with(
                service.db, user_id, replacement.id
            )

    @pytest.mark.anyio
    async def test_update_recurring_validates_new_account(self, service: FinanceService):
        """Updating account_id on a recurring expense should validate the new account."""
        user_id = uuid4()
        new_account_id = uuid4()
        existing = MockRecurring(user_id=user_id)
        data = RecurringExpenseUpdate(account_id=new_account_id)

        with patch("app.services.finance_service.finance_repo") as mock_repo:
            mock_repo.get_recurring_by_id_and_user = AsyncMock(return_value=existing)
            mock_repo.get_account_by_id_and_user = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError):
                await service.update_recurring(user_id, existing.id, data)


# ──────────────────────────── Budget null category ───────────────────────────


class TestFinanceServiceBudget:
    @pytest.fixture
    def mock_db(self) -> AsyncMock:
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_db: AsyncMock) -> FinanceService:
        return FinanceService(mock_db)

    @pytest.mark.anyio
    async def test_create_general_budget_no_category(self, service: FinanceService):
        """Creating a budget with category=None should work (general expenses budget)."""
        user_id = uuid4()
        data = BudgetCreate(month=3, year=2026, amount_limit=Decimal("500.00"))
        mock_budget = MockBudget(user_id=user_id, category=None)

        with patch("app.services.finance_service.finance_repo") as mock_repo:
            mock_repo.get_budget_by_category = AsyncMock(return_value=None)
            mock_repo.create_budget = AsyncMock(return_value=mock_budget)

            result = await service.create_budget(user_id, data)

            assert result == mock_budget
            mock_repo.get_budget_by_category.assert_called_once_with(
                service.db, user_id, None, 3, 2026
            )

    @pytest.mark.anyio
    async def test_get_budget_status_general_uses_total_expenses(self, service: FinanceService):
        """A null-category budget should use total monthly spending."""
        user_id = uuid4()
        general_budget = MockBudget(category=None, amount_limit=Decimal("1000.00"))

        spending = {
            "dining": Decimal("200.00"),
            "groceries": Decimal("300.00"),
            "subscriptions": Decimal("50.00"),
        }  # total = 550

        with patch("app.services.finance_service.finance_repo") as mock_repo:
            mock_repo.get_budgets_by_user = AsyncMock(return_value=[general_budget])
            mock_repo.get_spending_by_category = AsyncMock(return_value=spending)

            results = await service.get_budget_status(user_id, 3, 2026)

            assert len(results) == 1
            status = results[0]
            assert status.spent_amount == Decimal("550.00")
            assert status.remaining == Decimal("450.00")
            assert status.is_over_budget is False

    @pytest.mark.anyio
    async def test_get_budget_status_over_general_budget(self, service: FinanceService):
        """General budget that's over should show is_over_budget=True."""
        user_id = uuid4()
        general_budget = MockBudget(category=None, amount_limit=Decimal("400.00"))

        spending = {
            "dining": Decimal("200.00"),
            "groceries": Decimal("300.00"),
        }  # total = 500 > 400

        with patch("app.services.finance_service.finance_repo") as mock_repo:
            mock_repo.get_budgets_by_user = AsyncMock(return_value=[general_budget])
            mock_repo.get_spending_by_category = AsyncMock(return_value=spending)

            results = await service.get_budget_status(user_id, 3, 2026)

            assert results[0].is_over_budget is True
            assert results[0].spent_amount == Decimal("500.00")
