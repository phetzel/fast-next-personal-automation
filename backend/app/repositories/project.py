"""Project repository (PostgreSQL async).

Contains database operations for Project entity. Business logic
should be handled by ProjectService in app/services/project.py.
"""

from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.project import Project


async def get_by_id(db: AsyncSession, project_id: UUID) -> Project | None:
    """Get project by ID."""
    return await db.get(Project, project_id)


async def get_by_user_id(db: AsyncSession, user_id: UUID) -> list[Project]:
    """Get all projects for a user, ordered by active status and creation date."""
    result = await db.execute(
        select(Project)
        .where(Project.user_id == user_id)
        .order_by(Project.is_active.desc(), Project.created_at.desc())
    )
    return list(result.scalars().all())


async def get_active_for_user(db: AsyncSession, user_id: UUID) -> list[Project]:
    """Get all active projects for a user."""
    result = await db.execute(
        select(Project).where(
            and_(
                Project.user_id == user_id,
                Project.is_active == True,  # noqa: E712
            )
        ).order_by(Project.created_at.desc())
    )
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
    is_active: bool = True,
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
        is_active=is_active,
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


async def toggle_active(
    db: AsyncSession,
    project_id: UUID,
    user_id: UUID,
    is_active: bool,
) -> Project | None:
    """Toggle the active status of a project.
    
    Returns the updated project, or None if not found.
    """
    project = await get_by_id(db, project_id)
    if project and project.user_id == user_id:
        project.is_active = is_active
        db.add(project)
        await db.flush()
        await db.refresh(project)
        return project
    return None


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

