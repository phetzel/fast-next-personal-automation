"""Job CRUD tools for the Jobs area agent.

This module provides FunctionToolset tools for managing job listings
through the AI assistant, enabling list, get, delete, and stats operations.

Provides list, get, update status, delete, and stats operations.
"""

from uuid import UUID

from pydantic_ai import RunContext
from pydantic_ai.toolsets import FunctionToolset

from app.agents.tools.jobs.helpers import get_db_and_user
from app.db.models.job import JobStatus
from app.repositories import job as job_repo
from app.schemas.job import JobFilters, JobResponse, JobSummary, JobUpdate
from app.services.job import JobService

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

    Use this tool to browse and search through saved jobs. You can filter by
    status, search terms, relevance score, and source.

    Args:
        status: Filter by job status. Options: new, analyzed, prepped, reviewed, applied, rejected, interviewing
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
    db, user_id, error = get_db_and_user(ctx)
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
                "error": f"Invalid status '{status}'. Valid options: new, analyzed, prepped, reviewed, applied, rejected, interviewing",
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
    db, user_id, error = get_db_and_user(ctx)
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
    """Get statistics about the user's saved jobs.

    Returns counts by status, average relevance score, and count of
    high-scoring jobs (score >= 7.0).

    Returns:
        Dictionary with job statistics
    """
    db, user_id, error = get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    stats = await job_repo.get_stats(db, user_id)

    return {
        "success": True,
        "stats": {
            "total_jobs": stats["total"],
            "by_status": {
                "new": stats["new"],
                "analyzed": stats["analyzed"],
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
async def update_job_status(
    ctx: RunContext,
    job_id: str,
    status: str,
    notes: str | None = None,
) -> dict:
    """Update the status of a job in the user's workflow.

    Use this when the user says they've reviewed a job, applied to it,
    got an interview, or received a rejection.

    Status flow: new → analyzed → prepped → reviewed → applied
    Outcomes: applied → interviewing, applied → rejected, interviewing → rejected

    Args:
        job_id: The UUID of the job to update
        status: New status. Options: new, analyzed, prepped, reviewed, applied, interviewing, rejected
        notes: Optional note to append to the job (e.g., "Applied via LinkedIn")

    Returns:
        Updated job summary or error
    """
    db, user_id, error = get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    try:
        job_uuid = UUID(job_id)
    except ValueError:
        return {"success": False, "error": f"Invalid job ID format: {job_id}"}

    try:
        job_status = JobStatus(status.lower())
    except ValueError:
        return {
            "success": False,
            "error": f"Invalid status '{status}'. Valid options: new, analyzed, prepped, reviewed, applied, interviewing, rejected",
        }

    job_service = JobService(db)
    try:
        update_kwargs: dict[str, str | JobStatus] = {"status": job_status}
        if notes:
            job = await job_service.get_by_id(job_uuid, user_id)
            update_kwargs["notes"] = f"{job.notes}\n\n{notes}".strip() if job.notes else notes

        updated = await job_service.update(
            job_uuid,
            user_id,
            JobUpdate(**update_kwargs),
        )
    except Exception as exc:
        message = getattr(exc, "message", str(exc))
        return {"success": False, "error": message}

    return {
        "success": True,
        "message": f"Updated '{updated.title}' at {updated.company} to status: {job_status.value}",
        "job_id": str(updated.id),
        "new_status": job_status.value,
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
    db, user_id, error = get_db_and_user(ctx)
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
