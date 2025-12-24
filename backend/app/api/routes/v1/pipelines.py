"""Pipeline API routes.

Provides REST endpoints for:
- Listing available pipelines
- Getting pipeline details and schemas
- Executing pipelines (authenticated)
- Webhook receiver for external service integration
- Pipeline run history and statistics
"""

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DBSession, PipelineRunSvc, ValidAPIKey
from app.db.models.pipeline_run import PipelineRunStatus, PipelineTriggerType
from app.pipelines.action_base import PipelineContext, PipelineSource
from app.pipelines.registry import (
    execute_pipeline,
    get_pipeline_info,
    list_pipelines,
    list_pipelines_filtered,
)
from app.schemas.pipeline import (
    PipelineExecuteRequest,
    PipelineExecuteResponse,
    PipelineInfo,
    PipelineListResponse,
    PipelineWebhookPayload,
)
from app.schemas.pipeline_run import (
    PipelineRunListResponse,
    PipelineRunResponse,
    PipelineRunStatsResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=PipelineListResponse)
async def list_available_pipelines(
    area: str | None = Query(None, description="Filter by primary area (e.g., 'jobs')"),
    tags: str | None = Query(None, description="Filter by tags (comma-separated, e.g., 'ai,scraping')"),
) -> PipelineListResponse:
    """List all available pipelines with optional filtering.

    Returns pipeline names, descriptions, input/output schemas, tags, and area.
    This endpoint is public to allow frontend to discover available automations.

    Filtering:
    - area: Only return pipelines with this exact area (pipelines without area are excluded)
    - tags: Only return pipelines that have ALL specified tags
    """
    # Parse comma-separated tags
    tag_list = [t.strip() for t in tags.split(",")] if tags else None

    # Get filtered or all pipelines
    if area is not None or tag_list:
        pipelines = list_pipelines_filtered(area=area, tags=tag_list)
    else:
        pipelines = list_pipelines()

    return PipelineListResponse(
        pipelines=[PipelineInfo(**p) for p in pipelines],
        total=len(pipelines),
    )


# ===========================================================================
# Pipeline Run History Endpoints (must be before /{pipeline_name} routes)
# ===========================================================================


@router.get("/runs", response_model=PipelineRunListResponse)
async def list_pipeline_runs(
    run_service: PipelineRunSvc,
    current_user: CurrentUser,
    pipeline_name: str | None = Query(None, description="Filter by pipeline name"),
    status: PipelineRunStatus | None = Query(None, description="Filter by status"),
    trigger_type: PipelineTriggerType | None = Query(None, description="Filter by trigger type"),
    started_after: datetime | None = Query(None, description="Filter runs started after this time"),
    started_before: datetime | None = Query(None, description="Filter runs started before this time"),
    success_only: bool = Query(False, description="Only return successful runs"),
    error_only: bool = Query(False, description="Only return failed runs"),
    my_runs_only: bool = Query(False, description="Only show runs triggered by current user"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> PipelineRunListResponse:
    """List pipeline runs with filtering and pagination.

    Provides a comprehensive view of pipeline execution history.
    """
    user_id = current_user.id if my_runs_only else None

    runs, total = await run_service.list_runs(
        pipeline_name=pipeline_name,
        status=status,
        trigger_type=trigger_type,
        user_id=user_id,
        started_after=started_after,
        started_before=started_before,
        success_only=success_only,
        error_only=error_only,
        page=page,
        page_size=page_size,
    )

    return PipelineRunListResponse(
        runs=[PipelineRunResponse.model_validate(run) for run in runs],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total,
    )


@router.get("/runs/stats", response_model=PipelineRunStatsResponse)
async def get_pipeline_run_stats(
    run_service: PipelineRunSvc,
    current_user: CurrentUser,
    pipeline_name: str | None = Query(None, description="Filter by pipeline name"),
    since_hours: int = Query(24, ge=1, le=720, description="Stats for last N hours"),
) -> PipelineRunStatsResponse:
    """Get statistics about pipeline runs.

    Returns totals, success rates, and average duration.
    """
    stats = await run_service.get_stats(
        pipeline_name=pipeline_name,
        since_hours=since_hours,
    )
    return PipelineRunStatsResponse(**stats)


@router.get("/runs/{run_id}", response_model=PipelineRunResponse)
async def get_pipeline_run(
    run_id: UUID,
    run_service: PipelineRunSvc,
    current_user: CurrentUser,
) -> PipelineRunResponse:
    """Get details of a specific pipeline run."""
    run = await run_service.get_run(run_id)
    return PipelineRunResponse.model_validate(run)


@router.post(
    "/webhook/{pipeline_name}",
    response_model=PipelineExecuteResponse,
)
async def webhook_execute_pipeline(
    pipeline_name: str,
    payload: PipelineWebhookPayload,
    api_key: ValidAPIKey,
    db: DBSession,
) -> PipelineExecuteResponse:
    """Execute a pipeline via incoming webhook.

    Requires API key authentication via header.
    Useful for integrations with external services like Zapier, n8n, etc.
    Run history is automatically tracked.

    Args:
        pipeline_name: The pipeline to execute.
        payload: Webhook payload containing input and optional metadata.
        api_key: Valid API key (injected, validated via header).
        db: Database session for run tracking.

    Returns:
        PipelineExecuteResponse with success status and output/error.
    """
    context = PipelineContext(
        source=PipelineSource.WEBHOOK,
        user_id=None,  # Webhooks don't have user context
        metadata=payload.metadata,
    )

    logger.info(
        f"Webhook executing pipeline '{pipeline_name}'",
        extra={"pipeline": pipeline_name, "source": "webhook"},
    )

    result = await execute_pipeline(pipeline_name, payload.input, context, db=db)

    return PipelineExecuteResponse(
        success=result.success,
        output=result.output.model_dump(mode='json') if result.output else None,
        error=result.error,
        metadata=result.metadata,
    )


# ===========================================================================
# Dynamic pipeline routes (must be AFTER static routes like /runs)
# ===========================================================================


@router.get("/{pipeline_name}", response_model=PipelineInfo)
async def get_pipeline_details(pipeline_name: str) -> PipelineInfo:
    """Get details about a specific pipeline.

    Returns the pipeline's name, description, and JSON schemas for input/output.

    Args:
        pipeline_name: The unique pipeline identifier.

    Raises:
        404: If the pipeline is not found.
    """
    info = get_pipeline_info(pipeline_name)
    if info is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline '{pipeline_name}' not found",
        )
    return PipelineInfo(**info)


@router.post(
    "/{pipeline_name}/execute",
    response_model=PipelineExecuteResponse,
)
async def execute_pipeline_endpoint(
    pipeline_name: str,
    request: PipelineExecuteRequest,
    current_user: CurrentUser,
    db: DBSession,
    manual: bool = Query(False, description="Set to true for UI-triggered runs"),
) -> PipelineExecuteResponse:
    """Execute a pipeline by name.

    Requires authentication. The input is validated against the pipeline's
    input schema. Run history is automatically tracked.

    Args:
        pipeline_name: The pipeline to execute.
        request: Request body containing input data.
        current_user: The authenticated user (injected).
        db: Database session for run tracking.
        manual: If true, marks the run as manually triggered from UI.

    Returns:
        PipelineExecuteResponse with success status and output/error.
    """
    # Use MANUAL source if explicitly requested, otherwise API
    source = PipelineSource.MANUAL if manual else PipelineSource.API
    context = PipelineContext(
        source=source,
        user_id=current_user.id,
    )

    logger.info(
        f"Executing pipeline '{pipeline_name}' for user {current_user.id}",
        extra={"pipeline": pipeline_name, "user_id": str(current_user.id)},
    )

    result = await execute_pipeline(pipeline_name, request.input, context, db=db)

    return PipelineExecuteResponse(
        success=result.success,
        output=result.output.model_dump(mode='json') if result.output else None,
        error=result.error,
        metadata=result.metadata,
    )


@router.get("/{pipeline_name}/runs", response_model=PipelineRunListResponse)
async def get_runs_for_pipeline(
    pipeline_name: str,
    run_service: PipelineRunSvc,
    current_user: CurrentUser,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> PipelineRunListResponse:
    """Get run history for a specific pipeline."""
    # Verify pipeline exists
    if get_pipeline_info(pipeline_name) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline '{pipeline_name}' not found",
        )

    runs, total = await run_service.get_runs_for_pipeline(
        pipeline_name,
        page=page,
        page_size=page_size,
    )

    return PipelineRunListResponse(
        runs=[PipelineRunResponse.model_validate(run) for run in runs],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total,
    )
