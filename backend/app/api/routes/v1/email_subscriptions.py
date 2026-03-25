"""Email cleanup subscription review routes."""

from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession, EmailSvc
from app.schemas.email_cleanup import (
    EmailCleanupDecisionInput,
    EmailSubscriptionGroupResponse,
    EmailSubscriptionListResponse,
    EmailSubscriptionMessagePreview,
)

router = APIRouter()


def _serialize_group(group: dict) -> EmailSubscriptionGroupResponse:
    sample_messages = [
        EmailSubscriptionMessagePreview(
            id=message.id,
            subject=message.subject,
            received_at=message.received_at,
            source_email_address=message.source.email_address,
            bucket=message.bucket,
            unsubscribe_candidate=message.unsubscribe_candidate,
            archive_recommended=message.archive_recommended,
        )
        for message in group["sample_messages"]
    ]
    return EmailSubscriptionGroupResponse(
        sender_domain=group["sender_domain"],
        representative_sender=group["representative_sender"],
        representative_message_id=group["representative_message_id"],
        total_messages=group["total_messages"],
        unsubscribe_count=group["unsubscribe_count"],
        archive_count=group["archive_count"],
        latest_received_at=group["latest_received_at"],
        sample_messages=sample_messages,
    )


@router.get("", response_model=EmailSubscriptionListResponse)
async def list_subscription_groups(
    current_user: CurrentUser,
    email_service: EmailSvc,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> EmailSubscriptionListResponse:
    """List grouped cleanup candidates by sender domain."""
    groups, total = await email_service.list_subscription_groups(
        current_user.id,
        limit=limit,
        offset=offset,
    )
    return EmailSubscriptionListResponse(
        items=[_serialize_group(group) for group in groups],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/{message_id}/approve")
async def approve_subscription_group(
    message_id: UUID,
    input_data: EmailCleanupDecisionInput,
    db: DBSession,
    current_user: CurrentUser,
    email_service: EmailSvc,
) -> dict[str, str]:
    """Approve a grouped cleanup candidate and upsert a cleanup rule."""
    rule = await email_service.approve_subscription_group(
        message_id,
        current_user.id,
        reason=input_data.reason,
    )
    await db.commit()
    return {"rule_id": str(rule.id), "status": "approved"}


@router.post("/{message_id}/dismiss")
async def dismiss_subscription_group(
    message_id: UUID,
    input_data: EmailCleanupDecisionInput,
    db: DBSession,
    current_user: CurrentUser,
    email_service: EmailSvc,
) -> dict[str, str]:
    """Dismiss a grouped cleanup candidate and create an always-keep rule."""
    rule = await email_service.dismiss_subscription_group(
        message_id,
        current_user.id,
        reason=input_data.reason,
    )
    await db.commit()
    return {"rule_id": str(rule.id), "status": "dismissed"}
