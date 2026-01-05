"""Resume repository (PostgreSQL async).

Contains database operations for Resume entity. Business logic
should be handled by ResumeService in app/services/resume.py.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.resume import Resume
from app.repositories.base import PrimaryEntityRepository
from app.schemas.resume import ResumeCreate, ResumeUpdate


class ResumeRepository(PrimaryEntityRepository[Resume, ResumeCreate, ResumeUpdate]):
    """Repository for Resume entity operations."""

    def __init__(self):
        super().__init__(Resume)

    async def get_by_user_id(self, db: AsyncSession, user_id: UUID) -> list[Resume]:
        """Get all resumes for a user, ordered by primary status and creation date."""
        return await self.get_by_user_ordered(db, user_id)

    async def create(
        self,
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
        return await self.create_with_kwargs(
            db,
            user_id=user_id,
            name=name,
            original_filename=original_filename,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
            text_content=text_content,
            is_primary=is_primary,
        )

    async def update(
        self,
        db: AsyncSession,
        *,
        db_resume: Resume,
        update_data: dict,
    ) -> Resume:
        """Update a resume."""
        return await super().update(db, db_obj=db_resume, obj_in=update_data)

    async def delete(self, db: AsyncSession, resume_id: UUID) -> Resume | None:
        """Delete a resume by ID."""
        return await super().delete(db, id=resume_id)

    async def delete_by_user_id(self, db: AsyncSession, user_id: UUID) -> int:
        """Delete all resumes for a user. Returns count of deleted resumes."""
        return await self.delete_by_user(db, user_id)


# Module-level singleton for backward compatibility
_repository = ResumeRepository()


# Expose module-level functions for backward compatibility
async def get_by_id(db: AsyncSession, resume_id: UUID) -> Resume | None:
    """Get resume by ID."""
    return await _repository.get(db, resume_id)


async def get_by_user_id(db: AsyncSession, user_id: UUID) -> list[Resume]:
    """Get all resumes for a user, ordered by primary status and creation date."""
    return await _repository.get_by_user_id(db, user_id)


async def get_primary_for_user(db: AsyncSession, user_id: UUID) -> Resume | None:
    """Get the primary resume for a user."""
    return await _repository.get_primary_for_user(db, user_id)


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
    return await _repository.create(
        db,
        user_id=user_id,
        name=name,
        original_filename=original_filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        text_content=text_content,
        is_primary=is_primary,
    )


async def update(
    db: AsyncSession,
    *,
    db_resume: Resume,
    update_data: dict,
) -> Resume:
    """Update a resume."""
    return await _repository.update(db, db_resume=db_resume, update_data=update_data)


async def set_primary(
    db: AsyncSession,
    user_id: UUID,
    resume_id: UUID,
) -> Resume | None:
    """Set a resume as primary, unsetting any other primary."""
    return await _repository.set_primary(db, user_id, resume_id)


async def delete(db: AsyncSession, resume_id: UUID) -> Resume | None:
    """Delete a resume by ID."""
    return await _repository.delete(db, resume_id)


async def delete_by_user_id(db: AsyncSession, user_id: UUID) -> int:
    """Delete all resumes for a user. Returns count of deleted resumes."""
    return await _repository.delete_by_user_id(db, user_id)
