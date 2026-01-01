"""Email syncs API routes for sync history and triggering syncs."""

from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession, EmailSvc
from app.pipelines.action_base import PipelineContext
from app.pipelines.registry import execute_pipeline
from app.schemas.email_sync import (
    EmailSyncCreate,
    EmailSyncDetailResponse,
    EmailSyncListResponse,
    EmailSyncResponse,
    EmailSyncResult,
)

router = APIRouter()


@router.get("", response_model=EmailSyncListResponse)
async def list_syncs(
    current_user: CurrentUser,
    email_service: EmailSvc,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List email sync history for the current user."""
    syncs, total = await email_service.list_syncs(current_user.id, limit, offset)
    return EmailSyncListResponse(
        items=[EmailSyncResponse.model_validate(s) for s in syncs],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{sync_id}", response_model=EmailSyncDetailResponse)
async def get_sync(
    sync_id: UUID,
    current_user: CurrentUser,
    email_service: EmailSvc,
):
    """Get details of a specific email sync."""
    sync = await email_service.get_sync_by_id(sync_id, current_user.id)
    response = EmailSyncResponse.model_validate(sync)
    return EmailSyncDetailResponse.from_sync(response)


@router.post("", response_model=EmailSyncResult)
async def trigger_sync(
    sync_input: EmailSyncCreate,
    db: DBSession,
    current_user: CurrentUser,
    email_service: EmailSvc,
):
    """Trigger a new email sync for all active sources.

    Returns immediately with sync ID. The sync runs asynchronously.
    """
    # Start the sync record
    sync = await email_service.start_sync(current_user.id, sync_input.force_full_sync)

    # If sync was already running, return that
    if sync.status == "running" and sync.started_at:
        return EmailSyncResult(
            sync_id=sync.id,
            status="already_running",
            message="A sync is already in progress",
        )

    # Execute sync pipeline
    context = PipelineContext(
        user_id=current_user.id,
        source="api",
    )

    result = await execute_pipeline(
        "email_sync_jobs",
        {"force_full_sync": sync_input.force_full_sync},
        context,
        db=db,
    )

    await db.commit()

    if result.success:
        return EmailSyncResult(
            sync_id=sync.id,
            status="completed",
            message=f"Sync completed: {result.output.jobs_saved} jobs saved",
        )
    else:
        return EmailSyncResult(
            sync_id=sync.id,
            status="failed",
            message=result.error or "Sync failed",
        )
