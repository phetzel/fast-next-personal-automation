"""Tests for finances API routes."""

from datetime import UTC, date, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_db_session, get_finance_service, get_redis
from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.main import app

# ──────────────────── Mock objects ────────────────────────────────────────────


class MockUser:
    def __init__(self, id=None, email="test@example.com"):
        self.id = id or uuid4()
        self.email = email
        self.is_active = True
        self.is_superuser = False

    def has_role(self, role) -> bool:
        return False


class MockAccount:
    def __init__(self, id=None, user_id=None):
        self.id = id or uuid4()
        self.user_id = user_id or uuid4()
        self.name = "Test Checking"
        self.institution = "Test Bank"
        self.account_type = "checking"
        self.last_four = "1234"
        self.currency = "USD"
        self.current_balance = Decimal("1000.00")
        self.balance_updated_at = datetime.now(UTC)
        self.is_active = True
        self.notes = None
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)


class MockTransaction:
    def __init__(self, id=None, user_id=None, account_id=None):
        self.id = id or uuid4()
        self.user_id = user_id or uuid4()
        self.account_id = account_id
        self.recurring_expense_id = None
        self.amount = Decimal("-42.50")
        self.description = "Coffee shop"
        self.merchant = "Blue Bottle"
        self.transaction_date = date.today()
        self.posted_date = None
        self.transaction_type = "debit"
        self.category = "dining"
        self.category_confidence = None
        self.source = "manual"
        self.raw_email_id = None
        self.is_reviewed = False
        self.notes = None
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)


class MockBudget:
    def __init__(self, id=None, user_id=None):
        self.id = id or uuid4()
        self.user_id = user_id or uuid4()
        self.category = "dining"
        self.month = 3
        self.year = 2026
        self.amount_limit = Decimal("200.00")
        self.notes = None
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)


class MockRecurring:
    def __init__(self, id=None, user_id=None):
        self.id = id or uuid4()
        self.user_id = user_id or uuid4()
        self.name = "Netflix"
        self.merchant = "NETFLIX"
        self.category = "subscriptions"
        self.expected_amount = Decimal("15.99")
        self.billing_cycle = "monthly"
        self.next_due_date = None
        self.last_seen_date = None
        self.is_active = True
        self.auto_match = True
        self.notes = None
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)


# ──────────────────── Fixtures ────────────────────────────────────────────────


@pytest.fixture
def mock_user() -> MockUser:
    return MockUser()


@pytest.fixture
def mock_account(mock_user: MockUser) -> MockAccount:
    return MockAccount(user_id=mock_user.id)


@pytest.fixture
def mock_transaction(mock_user: MockUser) -> MockTransaction:
    return MockTransaction(user_id=mock_user.id)


@pytest.fixture
def mock_budget(mock_user: MockUser) -> MockBudget:
    return MockBudget(user_id=mock_user.id)


@pytest.fixture
def mock_recurring(mock_user: MockUser) -> MockRecurring:
    return MockRecurring(user_id=mock_user.id)


@pytest.fixture
def mock_finance_service(
    mock_account: MockAccount,
    mock_transaction: MockTransaction,
    mock_budget: MockBudget,
    mock_recurring: MockRecurring,
) -> MagicMock:
    service = MagicMock()

    # Accounts
    service.create_account = AsyncMock(return_value=mock_account)
    service.list_accounts = AsyncMock(return_value=[mock_account])
    service.get_account = AsyncMock(return_value=mock_account)
    service.update_account = AsyncMock(return_value=mock_account)
    service.delete_account = AsyncMock(return_value=None)
    service.update_balance = AsyncMock(return_value=mock_account)

    # Transactions
    service.create_transaction = AsyncMock(return_value=mock_transaction)
    service.list_transactions = AsyncMock(return_value=([mock_transaction], 1))
    service.get_transaction = AsyncMock(return_value=mock_transaction)
    service.update_transaction = AsyncMock(return_value=mock_transaction)
    service.delete_transaction = AsyncMock(return_value=None)
    service.mark_reviewed = AsyncMock(return_value=mock_transaction)
    service.import_csv = AsyncMock(return_value=(1, 0, []))
    service.categorize_with_ai = AsyncMock(return_value=(5, 0))

    # Stats
    service.get_stats = AsyncMock(
        return_value=MagicMock(
            total_accounts=1,
            current_month_income=Decimal("3000.00"),
            current_month_expenses=Decimal("500.00"),
            current_month_net=Decimal("2500.00"),
            current_month_transactions=10,
            unreviewed_count=2,
            active_recurring_count=3,
        )
    )

    # Budgets
    service.create_budget = AsyncMock(return_value=mock_budget)
    service.get_budgets = AsyncMock(return_value=[mock_budget])
    service.get_budget_status = AsyncMock(return_value=[])
    service.update_budget = AsyncMock(return_value=mock_budget)
    service.delete_budget = AsyncMock(return_value=None)

    # Recurring
    service.create_recurring = AsyncMock(return_value=mock_recurring)
    service.list_recurring = AsyncMock(return_value=[mock_recurring])
    service.update_recurring = AsyncMock(return_value=mock_recurring)
    service.delete_recurring = AsyncMock(return_value=None)

    return service


@pytest.fixture
async def auth_client(
    mock_user: MockUser,
    mock_finance_service: MagicMock,
    mock_redis: MagicMock,
    mock_db_session,
) -> AsyncClient:
    """Authenticated client with mocked finance service."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_finance_service] = lambda: mock_finance_service
    app.dependency_overrides[get_redis] = lambda: mock_redis
    app.dependency_overrides[get_db_session] = lambda: mock_db_session

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ──────────────────── Account tests ───────────────────────────────────────────


@pytest.mark.anyio
async def test_list_accounts(auth_client: AsyncClient, mock_account: MockAccount):
    response = await auth_client.get(f"{settings.API_V1_STR}/finances/accounts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["name"] == mock_account.name


@pytest.mark.anyio
async def test_create_account(auth_client: AsyncClient, mock_finance_service: MagicMock):
    response = await auth_client.post(
        f"{settings.API_V1_STR}/finances/accounts",
        json={"name": "Chase Checking", "account_type": "checking"},
    )
    assert response.status_code == 201
    mock_finance_service.create_account.assert_called_once()


@pytest.mark.anyio
async def test_get_account(auth_client: AsyncClient, mock_account: MockAccount):
    response = await auth_client.get(f"{settings.API_V1_STR}/finances/accounts/{mock_account.id}")
    assert response.status_code == 200
    assert response.json()["name"] == mock_account.name


@pytest.mark.anyio
async def test_get_account_not_found(auth_client: AsyncClient, mock_finance_service: MagicMock):
    mock_finance_service.get_account = AsyncMock(
        side_effect=NotFoundError(message="Account not found")
    )
    response = await auth_client.get(f"{settings.API_V1_STR}/finances/accounts/{uuid4()}")
    assert response.status_code == 404


@pytest.mark.anyio
async def test_update_account(
    auth_client: AsyncClient, mock_account: MockAccount, mock_finance_service: MagicMock
):
    response = await auth_client.patch(
        f"{settings.API_V1_STR}/finances/accounts/{mock_account.id}",
        json={"name": "Updated Name"},
    )
    assert response.status_code == 200
    mock_finance_service.update_account.assert_called_once()


@pytest.mark.anyio
async def test_delete_account(
    auth_client: AsyncClient, mock_account: MockAccount, mock_finance_service: MagicMock
):
    response = await auth_client.delete(
        f"{settings.API_V1_STR}/finances/accounts/{mock_account.id}"
    )
    assert response.status_code == 204
    mock_finance_service.delete_account.assert_called_once()


@pytest.mark.anyio
async def test_update_balance(
    auth_client: AsyncClient, mock_account: MockAccount, mock_finance_service: MagicMock
):
    response = await auth_client.patch(
        f"{settings.API_V1_STR}/finances/accounts/{mock_account.id}/balance",
        json={"current_balance": "2500.00"},
    )
    assert response.status_code == 200
    mock_finance_service.update_balance.assert_called_once()


# ──────────────────── Transaction tests ───────────────────────────────────────


@pytest.mark.anyio
async def test_list_transactions(auth_client: AsyncClient):
    response = await auth_client.get(f"{settings.API_V1_STR}/finances/transactions")
    assert response.status_code == 200
    data = response.json()
    assert "transactions" in data
    assert "total" in data
    assert data["total"] == 1


@pytest.mark.anyio
async def test_create_transaction(auth_client: AsyncClient, mock_finance_service: MagicMock):
    response = await auth_client.post(
        f"{settings.API_V1_STR}/finances/transactions",
        json={
            "description": "Coffee",
            "amount": -4.50,
            "transaction_date": "2026-03-01",
            "transaction_type": "debit",
        },
    )
    assert response.status_code == 201
    mock_finance_service.create_transaction.assert_called_once()


@pytest.mark.anyio
async def test_get_transaction(auth_client: AsyncClient, mock_transaction: MockTransaction):
    response = await auth_client.get(
        f"{settings.API_V1_STR}/finances/transactions/{mock_transaction.id}"
    )
    assert response.status_code == 200
    assert response.json()["description"] == mock_transaction.description


@pytest.mark.anyio
async def test_mark_reviewed(
    auth_client: AsyncClient, mock_transaction: MockTransaction, mock_finance_service: MagicMock
):
    response = await auth_client.post(
        f"{settings.API_V1_STR}/finances/transactions/{mock_transaction.id}/review"
    )
    assert response.status_code == 200
    mock_finance_service.mark_reviewed.assert_called_once()


@pytest.mark.anyio
async def test_delete_transaction(
    auth_client: AsyncClient, mock_transaction: MockTransaction, mock_finance_service: MagicMock
):
    response = await auth_client.delete(
        f"{settings.API_V1_STR}/finances/transactions/{mock_transaction.id}"
    )
    assert response.status_code == 204
    mock_finance_service.delete_transaction.assert_called_once()


# ──────────────────── Stats test ──────────────────────────────────────────────


@pytest.mark.anyio
async def test_get_stats(auth_client: AsyncClient):
    response = await auth_client.get(f"{settings.API_V1_STR}/finances/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_accounts" in data
    assert "current_month_net" in data
    assert "unreviewed_count" in data


# ──────────────────── Budget tests ────────────────────────────────────────────


@pytest.mark.anyio
async def test_create_budget(auth_client: AsyncClient, mock_finance_service: MagicMock):
    response = await auth_client.post(
        f"{settings.API_V1_STR}/finances/budgets",
        json={"category": "dining", "month": 3, "year": 2026, "amount_limit": 200.0},
    )
    assert response.status_code == 201
    mock_finance_service.create_budget.assert_called_once()


@pytest.mark.anyio
async def test_list_budgets(auth_client: AsyncClient):
    response = await auth_client.get(f"{settings.API_V1_STR}/finances/budgets?month=3&year=2026")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.anyio
async def test_get_budget_status(auth_client: AsyncClient):
    response = await auth_client.get(
        f"{settings.API_V1_STR}/finances/budgets/status?month=3&year=2026"
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.anyio
async def test_delete_budget(
    auth_client: AsyncClient, mock_budget: MockBudget, mock_finance_service: MagicMock
):
    response = await auth_client.delete(f"{settings.API_V1_STR}/finances/budgets/{mock_budget.id}")
    assert response.status_code == 204
    mock_finance_service.delete_budget.assert_called_once()


# ──────────────────── Recurring tests ─────────────────────────────────────────


@pytest.mark.anyio
async def test_list_recurring(auth_client: AsyncClient, mock_recurring: MockRecurring):
    response = await auth_client.get(f"{settings.API_V1_STR}/finances/recurring")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert data[0]["name"] == mock_recurring.name


@pytest.mark.anyio
async def test_create_recurring(auth_client: AsyncClient, mock_finance_service: MagicMock):
    response = await auth_client.post(
        f"{settings.API_V1_STR}/finances/recurring",
        json={"name": "Netflix", "billing_cycle": "monthly"},
    )
    assert response.status_code == 201
    mock_finance_service.create_recurring.assert_called_once()


@pytest.mark.anyio
async def test_delete_recurring(
    auth_client: AsyncClient, mock_recurring: MockRecurring, mock_finance_service: MagicMock
):
    response = await auth_client.delete(
        f"{settings.API_V1_STR}/finances/recurring/{mock_recurring.id}"
    )
    assert response.status_code == 204
    mock_finance_service.delete_recurring.assert_called_once()


# ──────────────────── Auth guard tests ────────────────────────────────────────


@pytest.mark.anyio
async def test_unauthenticated_returns_401(client: AsyncClient):
    """All finance endpoints should require authentication."""
    response = await client.get(f"{settings.API_V1_STR}/finances/accounts")
    assert response.status_code == 401
