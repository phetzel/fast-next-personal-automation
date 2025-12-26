"""Resume repository (PostgreSQL async).

Contains database operations for Resume entity. Business logic
should be handled by ResumeService in app/services/resume.py.
"""

from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.resume import Resume


async def get_by_id(db: AsyncSession, resume_id: UUID) -> Resume | None:
    """Get resume by ID."""
    return await db.get(Resume, resume_id)


async def get_by_user_id(db: AsyncSession, user_id: UUID) -> list[Resume]:
    """Get all resumes for a user, ordered by primary status and creation date."""
    result = await db.execute(
        select(Resume)
        .where(Resume.user_id == user_id)
        .order_by(Resume.is_primary.desc(), Resume.created_at.desc())
    )
    return list(result.scalars().all())


async def get_primary_for_user(db: AsyncSession, user_id: UUID) -> Resume | None:
    """Get the primary resume for a user."""
    result = await db.execute(
        select(Resume).where(
            and_(
                Resume.user_id == user_id,
                Resume.is_primary == True,  # noqa: E712
            )
        )
    )
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    user_id: UUID,
    name: str,
    original_filename: str,
    file_path: str,
    file_size: int,
    mime_type: str,
    text_content: str | None = None,
    is_primary: bool = False,
) -> Resume:
    """Create a new resume."""
    resume = Resume(
        user_id=user_id,
        name=name,
        original_filename=original_filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        text_content=text_content,
        is_primary=is_primary,
    )
    db.add(resume)
    await db.flush()
    await db.refresh(resume)
    return resume


async def update(
    db: AsyncSession,
    *,
    db_resume: Resume,
    update_data: dict,
) -> Resume:
    """Update a resume."""
    for field, value in update_data.items():
        setattr(db_resume, field, value)

    db.add(db_resume)
    await db.flush()
    await db.refresh(db_resume)
    return db_resume


async def set_primary(
    db: AsyncSession,
    user_id: UUID,
    resume_id: UUID,
) -> Resume | None:
    """Set a resume as primary, unsetting any other primary.

    Returns the updated resume, or None if not found.
    """
    # First, unset all primary for this user
    resumes = await get_by_user_id(db, user_id)
    for resume in resumes:
        if resume.is_primary and resume.id != resume_id:
            resume.is_primary = False
            db.add(resume)

    # Set the new primary
    target_resume = await get_by_id(db, resume_id)
    if target_resume and target_resume.user_id == user_id:
        target_resume.is_primary = True
        db.add(target_resume)
        await db.flush()
        await db.refresh(target_resume)
        return target_resume

    return None


async def delete(db: AsyncSession, resume_id: UUID) -> Resume | None:
    """Delete a resume by ID."""
    resume = await get_by_id(db, resume_id)
    if resume:
        await db.delete(resume)
        await db.flush()
    return resume


async def delete_by_user_id(db: AsyncSession, user_id: UUID) -> int:
    """Delete all resumes for a user. Returns count of deleted resumes."""
    resumes = await get_by_user_id(db, user_id)
    count = len(resumes)
    for resume in resumes:
        await db.delete(resume)
    await db.flush()
    return count
