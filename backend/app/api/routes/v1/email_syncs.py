"""Email syncs API routes for sync history and triggering syncs."""

from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession, EmailSvc
from app.pipelines.action_base import PipelineContext, PipelineSource
from app.pipelines.registry import execute_pipeline
from app.repositories import email_sync_repo
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

    Runs the sync synchronously and returns results when complete.
    """
    # Start the sync record (returns existing if one is running)
    sync, is_new = await email_service.start_sync(
        current_user.id, sync_input.force_full_sync
    )

    # If sync was already running, return that
    if not is_new:
        return EmailSyncResult(
            sync_id=sync.id,
            status="already_running",
            message="A sync is already in progress",
        )

    # Execute sync pipeline
    context = PipelineContext(
        user_id=current_user.id,
        source=PipelineSource.API,
    )

    result = await execute_pipeline(
        "email_sync_jobs",
        {"force_full_sync": sync_input.force_full_sync},
        context,
        db=db,
    )

    await db.commit()

    if result.success and result.output:
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


@router.post("/{sync_id}/cancel", response_model=EmailSyncResult)
async def cancel_sync(
    sync_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
    email_service: EmailSvc,
):
    """Cancel a running sync."""
    sync = await email_service.get_sync_by_id(sync_id, current_user.id)

    if sync.status not in ("pending", "running"):
        return EmailSyncResult(
            sync_id=sync.id,
            status=sync.status,
            message=f"Sync is already {sync.status}",
        )

    await email_sync_repo.cancel_sync(db, sync)
    await db.commit()

    return EmailSyncResult(
        sync_id=sync.id,
        status="cancelled",
        message="Sync has been cancelled",
    )


@router.post("/cancel-stale", response_model=EmailSyncResult)
async def cancel_stale_syncs(
    db: DBSession,
    current_user: CurrentUser,
):
    """Cancel any syncs that have been running for more than 10 minutes."""
    cancelled_count = await email_sync_repo.cancel_stale_syncs(db, current_user.id)
    await db.commit()

    return EmailSyncResult(
        sync_id=None,
        status="completed",
        message=f"Cancelled {cancelled_count} stale sync(s)",
    )
