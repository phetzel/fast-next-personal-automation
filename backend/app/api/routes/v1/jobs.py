"""Jobs API routes.

Provides REST endpoints for managing user's job listings from the search pipeline.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

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
    posted_within_hours: int | None = Query(
        None,
        ge=1,
        description="Filter to jobs posted within the last N hours (e.g., 24, 48, 72)",
    ),
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
        posted_within_hours=posted_within_hours,
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


# =============================================================================
# Batch operations (must be before /{job_id} routes to avoid path conflicts)
# =============================================================================


class DeleteByStatusRequest(BaseModel):
    """Request to delete all jobs with a specific status."""

    status: JobStatus = Field(description="Status of jobs to delete")


class DeleteByStatusResponse(BaseModel):
    """Response from batch delete operation."""

    deleted_count: int = Field(description="Number of jobs deleted")
    status: str = Field(description="Status that was deleted")


@router.post("/batch/delete", response_model=DeleteByStatusResponse)
async def delete_jobs_by_status(
    request: DeleteByStatusRequest,
    current_user: CurrentUser,
    job_service: JobSvc,
) -> DeleteByStatusResponse:
    """Delete all jobs with a specific status (soft delete).

    Use this to quickly clear out jobs you're not interested in.
    Jobs are soft-deleted (hidden from listings but preserved to prevent re-scraping).
    Only NEW, PREPPED, and REVIEWED statuses can be batch deleted.
    """
    from app.core.exceptions import ValidationError

    # Validate that the status can be batch deleted
    deletable_statuses = [JobStatus.NEW, JobStatus.PREPPED, JobStatus.REVIEWED]
    if request.status not in deletable_statuses:
        raise ValidationError(
            message=f"Only {', '.join(s.value for s in deletable_statuses)} statuses can be batch deleted",
            details={"status": request.status.value},
        )

    count = await job_service.delete_by_status(current_user.id, request.status)

    return DeleteByStatusResponse(
        deleted_count=count,
        status=request.status.value,
    )


# =============================================================================
# Single job operations
# =============================================================================


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


@router.post("/{job_id}/cover-letter/generate-pdf", response_model=JobResponse)
async def generate_cover_letter_pdf(
    job_id: UUID,
    current_user: CurrentUser,
    job_service: JobSvc,
) -> JobResponse:
    """Generate or regenerate a PDF from the job's cover letter.

    Creates a professionally formatted PDF cover letter and stores it in S3.
    Uses the user's default job profile for contact information.

    Call this after reviewing/editing the cover letter text.
    The generated PDF can then be downloaded or previewed.
    """
    job = await job_service.regenerate_cover_letter_pdf(job_id, current_user)
    return JobResponse.model_validate(job)


@router.get("/{job_id}/cover-letter/download")
async def download_cover_letter_pdf(
    job_id: UUID,
    current_user: CurrentUser,
    job_service: JobSvc,
) -> Response:
    """Download the generated cover letter PDF.

    Returns the PDF file with appropriate headers for browser download.
    Must call generate-pdf first to create the PDF.
    """
    pdf_bytes, filename = await job_service.get_cover_letter_pdf(job_id, current_user.id)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


@router.get("/{job_id}/cover-letter/preview")
async def preview_cover_letter_pdf(
    job_id: UUID,
    current_user: CurrentUser,
    job_service: JobSvc,
) -> Response:
    """Preview the generated cover letter PDF in browser.

    Returns the PDF file with inline disposition for browser viewing.
    Must have a generated PDF first.
    """
    pdf_bytes, filename = await job_service.get_cover_letter_pdf(job_id, current_user.id)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
