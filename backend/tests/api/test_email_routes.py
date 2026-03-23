"""Tests for email integration API routes."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.api.deps import get_current_user
from app.core.security import create_access_token, verify_token
from app.main import app


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> None:
    """Ensure dependency overrides are reset between tests."""
    yield
    app.dependency_overrides.clear()


def _mock_user() -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid4(),
        email="email@example.com",
        full_name="Email User",
        is_active=True,
        is_superuser=False,
        role="user",
        created_at=now,
        updated_at=now,
    )


@pytest.mark.anyio
async def test_create_gmail_connect_token(client) -> None:
    """The Gmail bootstrap endpoint should return a short-lived scoped token."""
    user = _mock_user()
    app.dependency_overrides[get_current_user] = lambda: user

    response = await client.get("/api/v1/email/gmail/connect-token")

    assert response.status_code == 200
    token = response.json()["connect_token"]
    payload = verify_token(token)

    assert payload is not None
    assert payload["sub"] == str(user.id)
    assert payload["type"] == "email_connect"


@pytest.mark.anyio
async def test_connect_gmail_rejects_normal_access_tokens(client) -> None:
    """The Gmail connect redirect should refuse normal bearer tokens."""
    access_token = create_access_token(str(uuid4()))

    response = await client.get(
        "/api/v1/email/gmail/connect",
        params={"connect_token": access_token},
        follow_redirects=False,
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid token type"


@pytest.mark.anyio
async def test_sync_email_source_returns_409_when_sync_running(client) -> None:
    """Manual source sync should refuse to start when another sync is already running."""
    user = _mock_user()
    source = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        is_active=True,
        email_address="email@example.com",
    )
    running_sync = SimpleNamespace(id=uuid4())

    app.dependency_overrides[get_current_user] = lambda: user

    from app.api.routes.v1 import email_sources as email_sources_route

    with (
        patch.object(
            email_sources_route.email_source_repo,
            "get_by_id",
            AsyncMock(return_value=source),
        ),
        patch.object(
            email_sources_route.EmailService,
            "start_sync",
            AsyncMock(return_value=(running_sync, False)),
        ),
    ):
        response = await client.post(f"/api/v1/email/sources/{source.id}/sync")

    assert response.status_code == 409
    assert response.json()["detail"] == "A sync is already in progress"
