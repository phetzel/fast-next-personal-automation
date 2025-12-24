"""Jobs API routes.

Provides REST endpoints for managing user's job listings from the search pipeline.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, JobSvc
from app.db.models.job import JobStatus
from app.schemas.job import (
    JobFilters,
    JobListResponse,
    JobResponse,
    JobStatsResponse,
    JobUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=JobListResponse)
async def list_jobs(
    current_user: CurrentUser,
    job_service: JobSvc,
    status: JobStatus | None = Query(None, description="Filter by status"),
    source: str | None = Query(None, description="Filter by source (linkedin, indeed, etc.)"),
    min_score: float | None = Query(None, ge=0.0, le=10.0, description="Minimum relevance score"),
    max_score: float | None = Query(None, ge=0.0, le=10.0, description="Maximum relevance score"),
    search: str | None = Query(None, description="Search in title, company, description"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order (asc/desc)"),
) -> JobListResponse:
    """List user's jobs with filtering and pagination.

    Returns scraped jobs from the job search pipeline, with their
    analysis scores and workflow status.
    """
    filters = JobFilters(
        status=status,
        source=source,
        min_score=min_score,
        max_score=max_score,
        search=search,
        page=page,
        page_size=page_size,
        sort_by=sort_by,  # type: ignore
        sort_order=sort_order,  # type: ignore
    )

    jobs, total = await job_service.get_by_user(current_user.id, filters)

    return JobListResponse(
        jobs=[JobResponse.model_validate(job) for job in jobs],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total,
    )


@router.get("/stats", response_model=JobStatsResponse)
async def get_job_stats(
    current_user: CurrentUser,
    job_service: JobSvc,
) -> JobStatsResponse:
    """Get statistics about user's jobs.

    Returns counts by status, average score, and high-scoring job count.
    """
    stats = await job_service.get_stats(current_user.id)
    return JobStatsResponse(**stats)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID,
    current_user: CurrentUser,
    job_service: JobSvc,
) -> JobResponse:
    """Get details of a specific job.

    Returns full job information including description and AI analysis.
    """
    job = await job_service.get_by_id(job_id, current_user.id)
    return JobResponse.model_validate(job)


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: UUID,
    job_in: JobUpdate,
    current_user: CurrentUser,
    job_service: JobSvc,
) -> JobResponse:
    """Update a job's status or notes.

    Users can mark jobs as reviewed, applied, rejected, or interviewing,
    and add personal notes.
    """
    job = await job_service.update(job_id, current_user.id, job_in)
    return JobResponse.model_validate(job)


@router.delete("/{job_id}", response_model=JobResponse)
async def delete_job(
    job_id: UUID,
    current_user: CurrentUser,
    job_service: JobSvc,
) -> JobResponse:
    """Delete a job from the user's list."""
    job = await job_service.delete(job_id, current_user.id)
    return JobResponse.model_validate(job)

