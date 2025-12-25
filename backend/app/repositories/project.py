"""Project repository (PostgreSQL async).

Contains database operations for Project entity. Business logic
should be handled by ProjectService in app/services/project.py.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.project import Project


async def get_by_id(db: AsyncSession, project_id: UUID) -> Project | None:
    """Get project by ID."""
    return await db.get(Project, project_id)


async def get_by_user_id(db: AsyncSession, user_id: UUID) -> list[Project]:
    """Get all projects for a user, ordered by creation date."""
    result = await db.execute(
        select(Project).where(Project.user_id == user_id).order_by(Project.created_at.desc())
    )
    return list(result.scalars().all())


async def get_by_ids(db: AsyncSession, project_ids: list[UUID]) -> list[Project]:
    """Get projects by IDs."""
    if not project_ids:
        return []
    result = await db.execute(select(Project).where(Project.id.in_(project_ids)))
    return list(result.scalars().all())


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
    project = Project(
        user_id=user_id,
        name=name,
        original_filename=original_filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        text_content=text_content,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


async def update(
    db: AsyncSession,
    *,
    db_project: Project,
    update_data: dict,
) -> Project:
    """Update a project."""
    for field, value in update_data.items():
        setattr(db_project, field, value)

    db.add(db_project)
    await db.flush()
    await db.refresh(db_project)
    return db_project


async def delete(db: AsyncSession, project_id: UUID) -> Project | None:
    """Delete a project by ID."""
    project = await get_by_id(db, project_id)
    if project:
        await db.delete(project)
        await db.flush()
    return project


async def delete_by_user_id(db: AsyncSession, user_id: UUID) -> int:
    """Delete all projects for a user. Returns count of deleted projects."""
    projects = await get_by_user_id(db, user_id)
    count = len(projects)
    for project in projects:
        await db.delete(project)
    await db.flush()
    return count
