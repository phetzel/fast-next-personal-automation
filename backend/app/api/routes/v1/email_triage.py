"""Email triage API routes."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import CurrentUser, DBSession, EmailSvc
from app.pipelines.action_base import PipelineContext, PipelineSource
from app.pipelines.registry import execute_pipeline
from app.schemas.email_triage import (
    EmailActionInput,
    EmailActionResponse,
    EmailBulkActionInput,
    EmailBulkActionResponse,
    EmailSourceAutoActionSettings,
    EmailTriageLastRunResponse,
    EmailTriageListResponse,
    EmailTriageMessageResponse,
    EmailTriageReviewInput,
    EmailTriageReviewResponse,
    EmailTriageRunInput,
    EmailTriageRunResult,
    EmailTriageStatsResponse,
)

router = APIRouter()


def _serialize_triage_message(message) -> EmailTriageMessageResponse:
    return EmailTriageMessageResponse(
        id=message.id,
        source_id=message.source_id,
        source_email_address=message.source.email_address,
        sync_id=message.sync_id,
        gmail_message_id=message.gmail_message_id,
        gmail_thread_id=message.gmail_thread_id,
        subject=message.subject,
        from_address=message.from_address,
        to_address=message.to_address,
        received_at=message.received_at,
        processed_at=message.processed_at,
        processing_error=message.processing_error,
        bucket=message.bucket,
        triage_status=message.triage_status,
        triage_confidence=message.triage_confidence,
        actionability_score=message.actionability_score,
        summary=message.summary,
        requires_review=message.requires_review,
        unsubscribe_candidate=message.unsubscribe_candidate,
        archive_recommended=getattr(message, "archive_recommended", False),
        is_vip=message.is_vip,
        triaged_at=message.triaged_at,
        last_action_at=message.last_action_at,
    )


@router.post("/run", response_model=EmailTriageRunResult)
async def run_email_triage(
    triage_input: EmailTriageRunInput,
    db: DBSession,
    current_user: CurrentUser,
) -> EmailTriageRunResult:
    """Run read-only email triage synchronously."""
    context = PipelineContext(
        user_id=current_user.id,
        source=PipelineSource.API,
    )
    result = await execute_pipeline(
        "email_triage",
        triage_input.model_dump(mode="json"),
        context,
        db=db,
    )
    await db.commit()

    if not result.success or result.output is None:
        raise HTTPException(status_code=500, detail=result.error or "Email triage failed")

    return result.output


@router.get("/messages", response_model=EmailTriageListResponse)
async def list_triage_messages(
    current_user: CurrentUser,
    email_service: EmailSvc,
    bucket: str | None = Query(default=None),
    source_id: UUID | None = Query(default=None),
    requires_review: bool | None = Query(default=None),
    unsubscribe_candidate: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> EmailTriageListResponse:
    """List triaged email messages for the current user."""
    messages, total = await email_service.list_triage_messages(
        current_user.id,
        bucket=bucket,
        source_id=source_id,
        requires_review=requires_review,
        unsubscribe_candidate=unsubscribe_candidate,
        limit=limit,
        offset=offset,
    )
    return EmailTriageListResponse(
        items=[_serialize_triage_message(message) for message in messages],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/messages/{message_id}", response_model=EmailTriageMessageResponse)
async def get_triage_message(
    message_id: UUID,
    current_user: CurrentUser,
    email_service: EmailSvc,
) -> EmailTriageMessageResponse:
    """Get a single triaged email message."""
    message = await email_service.get_triage_message(message_id, current_user.id)
    return _serialize_triage_message(message)


@router.post("/messages/{message_id}/review", response_model=EmailTriageReviewResponse)
async def review_triage_message(
    message_id: UUID,
    review_input: EmailTriageReviewInput,
    db: DBSession,
    current_user: CurrentUser,
    email_service: EmailSvc,
) -> EmailTriageReviewResponse:
    """Resolve a triaged review item without mutating Gmail."""
    message = await email_service.review_triage_message(
        message_id,
        current_user.id,
        decision=review_input.decision,
        bucket=review_input.bucket,
        reason=review_input.reason,
    )
    await db.commit()
    return EmailTriageReviewResponse(message=_serialize_triage_message(message))


@router.get("/stats", response_model=EmailTriageStatsResponse)
async def get_triage_stats(
    current_user: CurrentUser,
    email_service: EmailSvc,
) -> EmailTriageStatsResponse:
    """Get aggregate triage queue stats and the latest successful run."""
    stats = await email_service.get_triage_stats(current_user.id)
    last_run = stats["last_run"]
    last_run_response = None
    if last_run is not None:
        output_data = last_run.output_data or {}
        last_run_response = EmailTriageLastRunResponse(
            id=last_run.id,
            status=last_run.status,
            started_at=last_run.started_at,
            completed_at=last_run.completed_at,
            messages_scanned=output_data.get("messages_scanned", 0),
            messages_triaged=output_data.get("messages_triaged", 0),
            bucket_counts=output_data.get("bucket_counts", {}),
        )

    return EmailTriageStatsResponse(
        by_bucket=stats["by_bucket"],
        total_triaged=stats["total_triaged"],
        review_count=stats["review_count"],
        unsubscribe_count=stats["unsubscribe_count"],
        last_run=last_run_response,
    )


# --- Phase 4: Gmail Modify Action Endpoints ---


@router.post("/messages/{message_id}/actions", response_model=EmailActionResponse)
async def execute_message_action(
    message_id: UUID,
    action_input: EmailActionInput,
    db: DBSession,
    current_user: CurrentUser,
    email_service: EmailSvc,
) -> EmailActionResponse:
    """Execute a Gmail action (archive, mark_read, trash, label) on a message."""
    message = await email_service.get_triage_message(message_id, current_user.id)
    gmail = await email_service.get_gmail_client_for_message(message)

    action_log = await email_service.execute_action(
        message,
        current_user.id,
        gmail,
        action_type=action_input.action,
        action_source="user",
        label_name=action_input.label_name,
    )
    await email_service.save_refreshed_tokens(gmail, message)
    await db.commit()

    # Re-fetch message after updates
    updated_message = await email_service.get_triage_message(message_id, current_user.id)
    return EmailActionResponse(
        message=_serialize_triage_message(updated_message),
        action_log_id=action_log.id,
        action_type=action_log.action_type,
        action_status=action_log.action_status,
    )


@router.post("/messages/{message_id}/undo", response_model=EmailActionResponse)
async def undo_message_action(
    message_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
    email_service: EmailSvc,
) -> EmailActionResponse:
    """Undo the last applied action on a message."""
    message = await email_service.get_triage_message(message_id, current_user.id)
    gmail = await email_service.get_gmail_client_for_message(message)

    action_log = await email_service.undo_last_action(message, current_user.id, gmail)
    await email_service.save_refreshed_tokens(gmail, message)
    await db.commit()

    updated_message = await email_service.get_triage_message(message_id, current_user.id)
    return EmailActionResponse(
        message=_serialize_triage_message(updated_message),
        action_log_id=action_log.id,
        action_type=action_log.action_type,
        action_status=action_log.action_status,
    )


@router.post("/messages/bulk-action", response_model=EmailBulkActionResponse)
async def bulk_message_action(
    action_input: EmailBulkActionInput,
    db: DBSession,
    current_user: CurrentUser,
    email_service: EmailSvc,
) -> EmailBulkActionResponse:
    """Execute a bulk Gmail action on multiple messages."""
    succeeded = 0
    failed = 0
    action_log_ids: list[UUID] = []

    # Group messages by source to reuse GmailClient instances
    gmail_cache: dict[UUID, tuple] = {}  # source_id -> (gmail, sample_message)

    for mid in action_input.message_ids:
        try:
            message = await email_service.get_triage_message(mid, current_user.id)
            source_id = message.source_id
            if source_id not in gmail_cache:
                gmail = await email_service.get_gmail_client_for_message(message)
                gmail_cache[source_id] = (gmail, message)
            gmail, _ = gmail_cache[source_id]
            action_log = await email_service.execute_action(
                message,
                current_user.id,
                gmail,
                action_type=action_input.action,
                action_source="user",
            )
            action_log_ids.append(action_log.id)
            succeeded += 1
        except Exception:
            failed += 1

    # Save refreshed tokens for all used clients
    for gmail, sample_message in gmail_cache.values():
        await email_service.save_refreshed_tokens(gmail, sample_message)

    await db.commit()
    return EmailBulkActionResponse(
        succeeded=succeeded,
        failed=failed,
        action_log_ids=action_log_ids,
    )


@router.get("/sources/{source_id}/auto-actions", response_model=EmailSourceAutoActionSettings)
async def get_auto_action_settings(
    source_id: UUID,
    current_user: CurrentUser,
    email_service: EmailSvc,
) -> EmailSourceAutoActionSettings:
    """Get auto-action settings for an email source."""
    source = await email_service.get_source_auto_action_settings(source_id, current_user.id)
    return EmailSourceAutoActionSettings(
        auto_actions_enabled=source.auto_actions_enabled,
        auto_action_confidence_threshold=source.auto_action_confidence_threshold,
    )


@router.put("/sources/{source_id}/auto-actions", response_model=EmailSourceAutoActionSettings)
async def update_auto_action_settings(
    source_id: UUID,
    settings_input: EmailSourceAutoActionSettings,
    db: DBSession,
    current_user: CurrentUser,
    email_service: EmailSvc,
) -> EmailSourceAutoActionSettings:
    """Update auto-action settings for an email source."""
    source = await email_service.update_source_auto_action_settings(
        source_id,
        current_user.id,
        auto_actions_enabled=settings_input.auto_actions_enabled,
        auto_action_confidence_threshold=settings_input.auto_action_confidence_threshold,
    )
    await db.commit()
    return EmailSourceAutoActionSettings(
        auto_actions_enabled=source.auto_actions_enabled,
        auto_action_confidence_threshold=source.auto_action_confidence_threshold,
    )
