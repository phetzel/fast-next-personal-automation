"""Job CRUD tools for the Jobs area agent.

This module provides FunctionToolset tools for managing job listings
through the AI assistant, enabling list, get, delete, and stats operations.

Note: Status updates are handled by pipelines (job_prep), not directly
by the agent. The agent can delete jobs (soft delete) but cannot arbitrarily
change status.
"""

from uuid import UUID

from pydantic_ai import RunContext
from pydantic_ai.toolsets import FunctionToolset

from app.db.models.job import JobStatus
from app.repositories import job as job_repo
from app.schemas.job import JobFilters, JobResponse, JobSummary


def _get_db_and_user(ctx: RunContext) -> tuple:
    """Extract db session and user_id from context, with validation."""
    if not ctx.deps.db:
        return None, None, "Database session not available"
    if not ctx.deps.user_id:
        return None, None, "User not authenticated"
    try:
        user_id = UUID(ctx.deps.user_id)
    except ValueError:
        return None, None, "Invalid user ID"
    return ctx.deps.db, user_id, None


# Create the toolset
jobs_toolset = FunctionToolset()


@jobs_toolset.tool
async def list_jobs(
    ctx: RunContext,
    status: str | None = None,
    search: str | None = None,
    min_score: float | None = None,
    max_score: float | None = None,
    source: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """List the user's saved job listings with optional filtering and sorting.

    Use this tool to browse and search through jobs that have been scraped
    and analyzed. You can filter by status, search terms, relevance score,
    and source.

    Args:
        status: Filter by job status. Options: new, prepped, reviewed, applied, rejected, interviewing
        search: Search text in job title, company name, or description
        min_score: Minimum relevance score (0-10) to include
        max_score: Maximum relevance score (0-10) to include
        source: Filter by source (e.g., "linkedin", "indeed")
        sort_by: Sort field. Options: created_at, relevance_score, date_posted, company
        sort_order: Sort direction. Options: asc, desc
        page: Page number (starts at 1)
        page_size: Number of jobs per page (max 100)

    Returns:
        Dictionary with jobs list, total count, pagination info
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    # Parse status if provided
    job_status = None
    if status:
        try:
            job_status = JobStatus(status.lower())
        except ValueError:
            return {
                "success": False,
                "error": f"Invalid status '{status}'. Valid options: new, prepped, reviewed, applied, rejected, interviewing",
            }

    # Build filters
    filters = JobFilters(
        status=job_status,
        search=search,
        min_score=min_score,
        max_score=max_score,
        source=source,
        sort_by=sort_by
        if sort_by in ["created_at", "relevance_score", "date_posted", "company"]
        else "created_at",
        sort_order=sort_order if sort_order in ["asc", "desc"] else "desc",
        page=max(1, page),
        page_size=min(100, max(1, page_size)),
    )

    jobs, total = await job_repo.get_by_user(db, user_id, filters)

    return {
        "success": True,
        "jobs": [
            JobSummary(
                id=j.id,
                title=j.title,
                company=j.company,
                location=j.location,
                relevance_score=j.relevance_score,
                status=JobStatus(j.status),
                job_url=j.job_url,
            ).model_dump(mode="json")
            for j in jobs
        ],
        "total": total,
        "page": filters.page,
        "page_size": filters.page_size,
        "has_more": total > filters.page * filters.page_size,
    }


@jobs_toolset.tool
async def get_job(ctx: RunContext, job_id: str) -> dict:
    """Get detailed information about a specific job by its ID.

    Use this to retrieve full details including the job description,
    AI reasoning for the relevance score, and user notes.

    Args:
        job_id: The UUID of the job to retrieve

    Returns:
        Full job details or error if not found
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    try:
        job_uuid = UUID(job_id)
    except ValueError:
        return {"success": False, "error": f"Invalid job ID format: {job_id}"}

    job = await job_repo.get_by_id_and_user(db, job_uuid, user_id)
    if not job:
        return {"success": False, "error": f"Job not found with ID: {job_id}"}

    return {
        "success": True,
        "job": JobResponse.model_validate(job).model_dump(mode="json"),
    }


@jobs_toolset.tool
async def get_job_stats(ctx: RunContext) -> dict:
    """Get statistics about the user's job search.

    Returns counts by status, average relevance score, and count of
    high-scoring jobs (score >= 7.0).

    Returns:
        Dictionary with job statistics
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    stats = await job_repo.get_stats(db, user_id)

    return {
        "success": True,
        "stats": {
            "total_jobs": stats["total"],
            "by_status": {
                "new": stats["new"],
                "prepped": stats["prepped"],
                "reviewed": stats["reviewed"],
                "applied": stats["applied"],
                "rejected": stats["rejected"],
                "interviewing": stats["interviewing"],
            },
            "average_score": stats["avg_score"],
            "high_scoring_jobs": stats["high_scoring"],
        },
    }


@jobs_toolset.tool
async def delete_job(ctx: RunContext, job_id: str, reason: str | None = None) -> dict:
    """Delete a job the user is not interested in.

    This soft-deletes the job, removing it from active job lists while
    preserving the record to prevent the same job from being re-scraped.

    Use this when the user says they're not interested in a job, want to
    remove it from their list, or has decided not to apply.

    Args:
        job_id: The UUID of the job to delete
        reason: Optional reason for deleting (saved to notes before deletion)

    Returns:
        Success confirmation or error
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    try:
        job_uuid = UUID(job_id)
    except ValueError:
        return {"success": False, "error": f"Invalid job ID format: {job_id}"}

    # Get the job first
    job = await job_repo.get_by_id_and_user(db, job_uuid, user_id)
    if not job:
        return {"success": False, "error": f"Job not found with ID: {job_id}"}

    # Optionally add reason to notes before deletion
    if reason:
        existing_notes = job.notes or ""
        if existing_notes:
            update_data = {"notes": f"{existing_notes}\n\nRemoved: {reason}"}
        else:
            update_data = {"notes": f"Removed: {reason}"}
        await job_repo.update(db, db_job=job, update_data=update_data)

    # Soft delete the job
    deleted_job = await job_repo.delete(db, job_uuid, user_id)

    return {
        "success": True,
        "message": f"Deleted job: {deleted_job.title} at {deleted_job.company}",
    }
