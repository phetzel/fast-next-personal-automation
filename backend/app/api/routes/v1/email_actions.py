"""Email cleanup action log routes."""

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, EmailSvc
from app.schemas.email_cleanup import EmailActionLogListResponse, EmailActionLogResponse

router = APIRouter()


@router.get("/logs", response_model=EmailActionLogListResponse)
async def list_action_logs(
    current_user: CurrentUser,
    email_service: EmailSvc,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> EmailActionLogListResponse:
    """List cleanup audit logs for the current user."""
    logs, total = await email_service.list_action_logs(
        current_user.id,
        limit=limit,
        offset=offset,
    )
    return EmailActionLogListResponse(
        items=[
            EmailActionLogResponse(
                id=log.id,
                message_id=log.message_id,
                message_subject=log.message.subject if log.message else None,
                gmail_thread_id=log.gmail_thread_id,
                normalized_sender=log.normalized_sender,
                sender_domain=log.sender_domain,
                action_type=log.action_type,
                action_status=log.action_status,
                action_source=log.action_source,
                reason=log.reason,
                metadata=log.action_metadata,
                created_at=log.created_at,
            )
            for log in logs
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
