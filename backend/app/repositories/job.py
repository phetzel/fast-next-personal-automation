"""Job repository (PostgreSQL async).

Contains database operations for Job entity. Business logic
should be handled by JobService in app/services/job.py.
"""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.job import Job, JobStatus
from app.schemas.job import JobFilters


async def get_by_id(db: AsyncSession, job_id: UUID) -> Job | None:
    """Get job by ID."""
    return await db.get(Job, job_id)


async def get_by_id_and_user(db: AsyncSession, job_id: UUID, user_id: UUID) -> Job | None:
    """Get job by ID ensuring it belongs to the user (excludes soft-deleted)."""
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user_id, Job.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_by_url_and_user(db: AsyncSession, job_url: str, user_id: UUID) -> Job | None:
    """Check if a job URL already exists for a user (includes soft-deleted to prevent re-scraping)."""
    result = await db.execute(select(Job).where(Job.job_url == job_url, Job.user_id == user_id))
    return result.scalar_one_or_none()


def _apply_filters(query: Select, user_id: UUID, filters: JobFilters) -> Select:
    """Apply filters to a job query (excludes soft-deleted jobs)."""
    query = query.where(Job.user_id == user_id, Job.deleted_at.is_(None))

    if filters.status:
        query = query.where(Job.status == filters.status.value)

    if filters.source:
        query = query.where(Job.source == filters.source)

    if filters.min_score is not None:
        query = query.where(Job.relevance_score >= filters.min_score)

    if filters.max_score is not None:
        query = query.where(Job.relevance_score <= filters.max_score)

    if filters.search:
        search_term = f"%{filters.search}%"
        query = query.where(
            or_(
                Job.title.ilike(search_term),
                Job.company.ilike(search_term),
                Job.description.ilike(search_term),
            )
        )

    return query


def _apply_sorting(query: Select, filters: JobFilters) -> Select:
    """Apply sorting to a job query."""
    sort_column = {
        "created_at": Job.created_at,
        "relevance_score": Job.relevance_score,
        "date_posted": Job.date_posted,
        "company": Job.company,
    }.get(filters.sort_by, Job.created_at)

    if filters.sort_order == "asc":
        query = query.order_by(sort_column.asc().nullslast())
    else:
        query = query.order_by(sort_column.desc().nullsfirst())

    return query


async def get_by_user(
    db: AsyncSession,
    user_id: UUID,
    filters: JobFilters,
) -> tuple[list[Job], int]:
    """Get paginated jobs for a user with filtering."""
    # Base query
    base_query = select(Job)
    base_query = _apply_filters(base_query, user_id, filters)

    # Count query
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Data query with sorting and pagination
    data_query = _apply_sorting(base_query, filters)
    offset = (filters.page - 1) * filters.page_size
    data_query = data_query.offset(offset).limit(filters.page_size)

    result = await db.execute(data_query)
    jobs = list(result.scalars().all())

    return jobs, total


async def create(
    db: AsyncSession,
    *,
    user_id: UUID,
    title: str,
    company: str,
    job_url: str,
    location: str | None = None,
    description: str | None = None,
    salary_range: str | None = None,
    date_posted=None,
    source: str | None = None,
    relevance_score: float | None = None,
    reasoning: str | None = None,
    search_terms: str | None = None,
    is_remote: bool | None = None,
    job_type: str | None = None,
    company_url: str | None = None,
) -> Job:
    """Create a new job."""
    job = Job(
        user_id=user_id,
        title=title,
        company=company,
        job_url=job_url,
        location=location,
        description=description,
        salary_range=salary_range,
        date_posted=date_posted,
        source=source,
        relevance_score=relevance_score,
        reasoning=reasoning,
        search_terms=search_terms,
        is_remote=is_remote,
        job_type=job_type,
        company_url=company_url,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job


async def create_bulk(
    db: AsyncSession,
    user_id: UUID,
    jobs_data: list[dict],
) -> list[Job]:
    """Create multiple jobs at once, skipping duplicates.

    Args:
        db: Database session
        user_id: User ID to associate jobs with
        jobs_data: List of job dictionaries with fields matching Job model

    Returns:
        List of created Job instances (excludes duplicates)
    """
    created_jobs = []

    for job_data in jobs_data:
        # Check for duplicate
        existing = await get_by_url_and_user(db, job_data["job_url"], user_id)
        if existing:
            continue

        job = Job(user_id=user_id, **job_data)
        db.add(job)
        created_jobs.append(job)

    if created_jobs:
        await db.flush()
        for job in created_jobs:
            await db.refresh(job)

    return created_jobs


async def update(
    db: AsyncSession,
    *,
    db_job: Job,
    update_data: dict,
) -> Job:
    """Update a job."""
    for field, value in update_data.items():
        setattr(db_job, field, value)

    db.add(db_job)
    await db.flush()
    await db.refresh(db_job)
    return db_job


async def update_status(
    db: AsyncSession,
    job_id: UUID,
    user_id: UUID,
    status: JobStatus,
) -> Job | None:
    """Update job status."""
    job = await get_by_id_and_user(db, job_id, user_id)
    if job:
        job.status = status.value
        db.add(job)
        await db.flush()
        await db.refresh(job)
    return job


async def delete(db: AsyncSession, job_id: UUID, user_id: UUID) -> Job | None:
    """Soft delete a job (sets deleted_at timestamp).

    Soft-deleted jobs are excluded from listings but still checked for duplicates
    to prevent re-scraping the same job.
    """
    job = await get_by_id_and_user(db, job_id, user_id)
    if job:
        job.deleted_at = datetime.now(UTC)
        db.add(job)
        await db.flush()
        await db.refresh(job)
    return job


async def get_stats(db: AsyncSession, user_id: UUID) -> dict:
    """Get job statistics for a user (excludes soft-deleted jobs)."""
    # Count by status
    status_query = (
        select(
            Job.status,
            func.count(Job.id).label("count"),
        )
        .where(Job.user_id == user_id, Job.deleted_at.is_(None))
        .group_by(Job.status)
    )

    result = await db.execute(status_query)
    status_counts = {row.status: row.count for row in result}

    # Average score
    avg_query = select(func.avg(Job.relevance_score)).where(
        Job.user_id == user_id,
        Job.deleted_at.is_(None),
        Job.relevance_score.isnot(None),
    )
    avg_result = await db.execute(avg_query)
    avg_score = avg_result.scalar()

    # High scoring count (>= 7.0)
    high_query = select(func.count(Job.id)).where(
        Job.user_id == user_id,
        Job.deleted_at.is_(None),
        Job.relevance_score >= 7.0,
    )
    high_result = await db.execute(high_query)
    high_scoring = high_result.scalar() or 0

    # Total count
    total_query = select(func.count(Job.id)).where(Job.user_id == user_id, Job.deleted_at.is_(None))
    total_result = await db.execute(total_query)
    total = total_result.scalar() or 0

    return {
        "total": total,
        "new": status_counts.get(JobStatus.NEW.value, 0),
        "prepped": status_counts.get(JobStatus.PREPPED.value, 0),
        "reviewed": status_counts.get(JobStatus.REVIEWED.value, 0),
        "applied": status_counts.get(JobStatus.APPLIED.value, 0),
        "rejected": status_counts.get(JobStatus.REJECTED.value, 0),
        "interviewing": status_counts.get(JobStatus.INTERVIEWING.value, 0),
        "avg_score": round(avg_score, 2) if avg_score else None,
        "high_scoring": high_scoring,
    }
