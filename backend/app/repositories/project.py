"""Project repository (PostgreSQL async).

Contains database operations for Project entity. Business logic
should be handled by ProjectService in app/services/project.py.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.project import Project
from app.repositories.base import UserOwnedRepository
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectRepository(UserOwnedRepository[Project, ProjectCreate, ProjectUpdate]):
    """Repository for Project entity operations."""

    def __init__(self):
        super().__init__(Project)

    async def get_by_user_id(self, db: AsyncSession, user_id: UUID) -> list[Project]:
        """Get all projects for a user, ordered by creation date."""
        result = await db.execute(
            select(Project).where(Project.user_id == user_id).order_by(Project.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_ids(self, db: AsyncSession, project_ids: list[UUID]) -> list[Project]:
        """Get projects by IDs."""
        if not project_ids:
            return []
        result = await db.execute(select(Project).where(Project.id.in_(project_ids)))
        return list(result.scalars().all())

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
    ) -> Project:
        """Create a new project."""
        return await self.create_with_kwargs(
            db,
            user_id=user_id,
            name=name,
            original_filename=original_filename,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
            text_content=text_content,
        )

    async def update(
        self,
        db: AsyncSession,
        *,
        db_project: Project,
        update_data: dict,
    ) -> Project:
        """Update a project."""
        return await super().update(db, db_obj=db_project, obj_in=update_data)

    async def delete(self, db: AsyncSession, project_id: UUID) -> Project | None:
        """Delete a project by ID."""
        return await super().delete(db, id=project_id)

    async def delete_by_user_id(self, db: AsyncSession, user_id: UUID) -> int:
        """Delete all projects for a user. Returns count of deleted projects."""
        projects = await self.get_by_user_id(db, user_id)
        count = len(projects)
        for project in projects:
            await db.delete(project)
        await db.flush()
        return count


# Module-level singleton for backward compatibility
_repository = ProjectRepository()


# Expose module-level functions for backward compatibility
async def get_by_id(db: AsyncSession, project_id: UUID) -> Project | None:
    """Get project by ID."""
    return await _repository.get(db, project_id)


async def get_by_user_id(db: AsyncSession, user_id: UUID) -> list[Project]:
    """Get all projects for a user, ordered by creation date."""
    return await _repository.get_by_user_id(db, user_id)


async def get_by_ids(db: AsyncSession, project_ids: list[UUID]) -> list[Project]:
    """Get projects by IDs."""
    return await _repository.get_by_ids(db, project_ids)


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
) -> Project:
    """Create a new project."""
    return await _repository.create(
        db,
        user_id=user_id,
        name=name,
        original_filename=original_filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        text_content=text_content,
    )


async def update(
    db: AsyncSession,
    *,
    db_project: Project,
    update_data: dict,
) -> Project:
    """Update a project."""
    return await _repository.update(db, db_project=db_project, update_data=update_data)


async def delete(db: AsyncSession, project_id: UUID) -> Project | None:
    """Delete a project by ID."""
    return await _repository.delete(db, project_id)


async def delete_by_user_id(db: AsyncSession, user_id: UUID) -> int:
    """Delete all projects for a user. Returns count of deleted projects."""
    return await _repository.delete_by_user_id(db, user_id)
