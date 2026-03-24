"""Tests for email integration API routes."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.api.deps import get_current_user, get_email_service
from app.core.security import create_access_token, verify_token
from app.main import app
from app.schemas.email_triage import EmailTriageRunResult


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


@pytest.mark.anyio
async def test_run_email_triage_returns_pipeline_output(client, mock_db_session) -> None:
    """Manual triage runs should proxy the pipeline result."""
    user = _mock_user()
    app.dependency_overrides[get_current_user] = lambda: user

    from app.api.routes.v1 import email_triage as email_triage_route

    triage_result = EmailTriageRunResult(
        messages_scanned=12,
        messages_triaged=7,
        bucket_counts={"jobs": 2, "newsletter": 5},
        sources_processed=1,
        errors=[],
    )

    with patch.object(
        email_triage_route,
        "execute_pipeline",
        AsyncMock(return_value=SimpleNamespace(success=True, output=triage_result, error=None)),
    ):
        response = await client.post("/api/v1/email/triage/run", json={})

    assert response.status_code == 200
    assert response.json()["messages_triaged"] == 7
    mock_db_session.commit.assert_awaited()


@pytest.mark.anyio
async def test_list_triage_messages_filters_and_serializes(client) -> None:
    """Triage list endpoint should return serialized queue items."""
    user = _mock_user()
    app.dependency_overrides[get_current_user] = lambda: user

    source = SimpleNamespace(email_address="email@example.com")
    message = SimpleNamespace(
        id=uuid4(),
        source_id=uuid4(),
        source=source,
        sync_id=None,
        gmail_message_id="gmail-1",
        gmail_thread_id="thread-1",
        subject="Weekly roundup",
        from_address="newsletter@example.com",
        to_address="me@example.com",
        received_at=datetime.now(UTC),
        processed_at=None,
        processing_error=None,
        bucket="newsletter",
        triage_status="classified",
        triage_confidence=0.92,
        actionability_score=0.18,
        summary="A summary",
        requires_review=False,
        unsubscribe_candidate=True,
        is_vip=False,
        triaged_at=datetime.now(UTC),
        last_action_at=None,
    )

    email_service = SimpleNamespace(
        list_triage_messages=AsyncMock(return_value=([message], 1)),
    )
    app.dependency_overrides[get_email_service] = lambda: email_service

    response = await client.get(
        "/api/v1/email/triage/messages",
        params={"bucket": "newsletter", "unsubscribe_candidate": "true"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["bucket"] == "newsletter"
    assert payload["items"][0]["source_email_address"] == "email@example.com"
    email_service.list_triage_messages.assert_awaited()


@pytest.mark.anyio
async def test_get_triage_stats_returns_last_run_summary(client) -> None:
    """Stats endpoint should expose aggregate counts and last successful run info."""
    user = _mock_user()
    app.dependency_overrides[get_current_user] = lambda: user

    last_run = SimpleNamespace(
        id=uuid4(),
        status="success",
        started_at=datetime.now(UTC),
        completed_at=datetime.now(UTC),
        output_data={
            "messages_scanned": 20,
            "messages_triaged": 10,
            "bucket_counts": {"jobs": 3},
        },
    )
    email_service = SimpleNamespace(
        get_triage_stats=AsyncMock(
            return_value={
                "by_bucket": {"jobs": 3, "review": 2},
                "total_triaged": 5,
                "review_count": 2,
                "unsubscribe_count": 1,
                "last_run": last_run,
            }
        )
    )
    app.dependency_overrides[get_email_service] = lambda: email_service

    response = await client.get("/api/v1/email/triage/stats")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_triaged"] == 5
    assert payload["last_run"]["messages_triaged"] == 10


@pytest.mark.anyio
async def test_review_triage_message_returns_updated_message(client, mock_db_session) -> None:
    """Review endpoint should proxy the updated triage message."""
    user = _mock_user()
    app.dependency_overrides[get_current_user] = lambda: user

    source = SimpleNamespace(email_address="email@example.com")
    message = SimpleNamespace(
        id=uuid4(),
        source_id=uuid4(),
        source=source,
        sync_id=None,
        gmail_message_id="gmail-1",
        gmail_thread_id="thread-1",
        subject="Needs review",
        from_address="sender@example.com",
        to_address="me@example.com",
        received_at=datetime.now(UTC),
        processed_at=None,
        processing_error=None,
        bucket="now",
        triage_status="reviewed",
        triage_confidence=0.72,
        actionability_score=0.82,
        summary="Review me",
        requires_review=False,
        unsubscribe_candidate=False,
        archive_recommended=False,
        is_vip=False,
        triaged_at=datetime.now(UTC),
        last_action_at=datetime.now(UTC),
    )
    email_service = SimpleNamespace(review_triage_message=AsyncMock(return_value=message))
    app.dependency_overrides[get_email_service] = lambda: email_service

    response = await client.post(
        f"/api/v1/email/triage/messages/{message.id}/review",
        json={"decision": "reviewed", "bucket": "now"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["message"]["triage_status"] == "reviewed"
    assert payload["message"]["bucket"] == "now"
    mock_db_session.commit.assert_awaited()


@pytest.mark.anyio
async def test_list_subscription_groups_serializes_groups(client) -> None:
    """Cleanup subscriptions endpoint should serialize grouped sender review data."""
    user = _mock_user()
    app.dependency_overrides[get_current_user] = lambda: user

    source = SimpleNamespace(email_address="email@example.com")
    message = SimpleNamespace(
        id=uuid4(),
        source=source,
        subject="Weekly roundup",
        received_at=datetime.now(UTC),
        bucket="newsletter",
        unsubscribe_candidate=True,
        archive_recommended=True,
    )
    email_service = SimpleNamespace(
        list_subscription_groups=AsyncMock(
            return_value=(
                [
                    {
                        "sender_domain": "example.com",
                        "representative_sender": "newsletter@example.com",
                        "representative_message_id": message.id,
                        "total_messages": 3,
                        "unsubscribe_count": 2,
                        "archive_count": 3,
                        "latest_received_at": datetime.now(UTC),
                        "sample_messages": [message],
                    }
                ],
                1,
            )
        )
    )
    app.dependency_overrides[get_email_service] = lambda: email_service

    response = await client.get("/api/v1/email/subscriptions")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["sender_domain"] == "example.com"
    assert payload["items"][0]["sample_messages"][0]["archive_recommended"] is True


@pytest.mark.anyio
async def test_list_action_logs_serializes_cleanup_history(client) -> None:
    """Cleanup audit log endpoint should serialize action entries."""
    user = _mock_user()
    app.dependency_overrides[get_current_user] = lambda: user

    log = SimpleNamespace(
        id=uuid4(),
        message_id=uuid4(),
        message=SimpleNamespace(subject="Weekly roundup"),
        gmail_thread_id="thread-1",
        normalized_sender="newsletter@example.com",
        sender_domain="example.com",
        action_type="cleanup_rule",
        action_status="approved",
        action_source="user",
        reason="Looks safe",
        action_metadata={"bucket": "newsletter"},
        created_at=datetime.now(UTC),
    )
    email_service = SimpleNamespace(list_action_logs=AsyncMock(return_value=([log], 1)))
    app.dependency_overrides[get_email_service] = lambda: email_service

    response = await client.get("/api/v1/email/actions/logs")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["action_type"] == "cleanup_rule"
    assert payload["items"][0]["metadata"]["bucket"] == "newsletter"
