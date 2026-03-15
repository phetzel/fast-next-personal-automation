# ruff: noqa: I001 - Imports structured for Jinja2 template conditionals
"""Tests for authentication routes."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.api.deps import get_session_service, get_user_service
from app.core.config import settings
from app.main import app


class MockUser:
    """Mock user for testing."""

    def __init__(
        self,
        id=None,
        email="test@example.com",
        full_name="Test User",
        is_active=True,
        is_superuser=False,
    ):
        self.id = id or uuid4()
        self.email = email
        self.full_name = full_name
        self.is_active = is_active
        self.is_superuser = is_superuser
        self.hashed_password = "hashed"
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)


@pytest.fixture
def mock_user() -> MockUser:
    """Create a mock user."""
    return MockUser()


@pytest.fixture
def mock_user_service(mock_user: MockUser) -> MagicMock:
    """Create a mock user service."""
    service = MagicMock()
    service.authenticate = AsyncMock(return_value=mock_user)
    service.register = AsyncMock(return_value=mock_user)
    service.get_by_id = AsyncMock(return_value=mock_user)
    service.get_by_email = AsyncMock(return_value=mock_user)
    return service


@pytest.fixture
def mock_session_service(mock_user: MockUser) -> MagicMock:
    """Create a mock session service."""
    session = MagicMock()
    session.user_id = mock_user.id

    service = MagicMock()
    service.create_session = AsyncMock(return_value=session)
    service.validate_refresh_token = AsyncMock(return_value=session)
    service.logout_by_refresh_token = AsyncMock(return_value=session)
    return service


@pytest.fixture
async def client_with_mock_service(
    mock_user_service: MagicMock,
    mock_session_service: MagicMock,
    mock_redis: MagicMock,
    mock_db_session,
) -> AsyncClient:
    """Client with mocked user service."""
    from app.api.deps import get_redis
    from app.api.deps import get_db_session
    from httpx import ASGITransport

    app.dependency_overrides[get_user_service] = lambda: mock_user_service
    app.dependency_overrides[get_session_service] = lambda: mock_session_service
    app.dependency_overrides[get_redis] = lambda: mock_redis
    app.dependency_overrides[get_db_session] = lambda: mock_db_session

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_login_success(client_with_mock_service: AsyncClient):
    """Test successful login."""
    response = await client_with_mock_service.post(
        f"{settings.API_V1_STR}/auth/login",
        data={"username": "test@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.anyio
async def test_login_invalid_credentials(
    client_with_mock_service: AsyncClient,
    mock_user_service: MagicMock,
):
    """Test login with invalid credentials."""
    from app.core.exceptions import AuthenticationError

    mock_user_service.authenticate = AsyncMock(
        side_effect=AuthenticationError(message="Invalid credentials")
    )

    response = await client_with_mock_service.post(
        f"{settings.API_V1_STR}/auth/login",
        data={"username": "test@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


# NOTE: Registration is disabled in production, tests removed
# @pytest.mark.anyio
# async def test_register_success(client_with_mock_service: AsyncClient):
#     """Test successful registration."""
#     ...

# @pytest.mark.anyio
# async def test_register_duplicate_email(...):
#     """Test registration with duplicate email."""
#     ...


@pytest.mark.anyio
async def test_get_current_user(
    client_with_mock_service: AsyncClient,
    mock_user: MockUser,
    mock_user_service: MagicMock,
):
    """Test getting current user info."""
    from app.api.deps import get_current_user

    # Override get_current_user to return mock user
    app.dependency_overrides[get_current_user] = lambda: mock_user

    response = await client_with_mock_service.get(
        f"{settings.API_V1_STR}/auth/me",
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == mock_user.email


@pytest.mark.anyio
async def test_refresh_token_success(
    client_with_mock_service: AsyncClient,
    mock_session_service: MagicMock,
    mock_user: MockUser,
):
    """Test refreshing a valid session."""
    refresh_token = "existing-refresh-token"

    response = await client_with_mock_service.post(
        f"{settings.API_V1_STR}/auth/refresh",
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

    mock_session_service.validate_refresh_token.assert_awaited_once_with(refresh_token)
    mock_session_service.logout_by_refresh_token.assert_awaited_once_with(refresh_token)
    mock_session_service.create_session.assert_awaited_once()

    create_session_kwargs = mock_session_service.create_session.await_args.kwargs
    assert create_session_kwargs["user_id"] == mock_user.id
    assert create_session_kwargs["refresh_token"] == data["refresh_token"]


@pytest.mark.anyio
async def test_logout_invalidates_refresh_token_session(
    client_with_mock_service: AsyncClient,
    mock_session_service: MagicMock,
):
    """Test logging out invalidates the session tied to the refresh token."""
    refresh_token = "refresh-token-to-revoke"

    response = await client_with_mock_service.post(
        f"{settings.API_V1_STR}/auth/logout",
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 204
    mock_session_service.logout_by_refresh_token.assert_awaited_once_with(refresh_token)
