"""Story repository (PostgreSQL async).

Contains database operations for Story entity. Business logic
should be handled by StoryService in app/services/story.py.
"""

from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.story import Story


async def get_by_id(db: AsyncSession, story_id: UUID) -> Story | None:
    """Get story by ID."""
    return await db.get(Story, story_id)


async def get_by_user_id(db: AsyncSession, user_id: UUID) -> list[Story]:
    """Get all stories for a user, ordered by primary status and creation date."""
    result = await db.execute(
        select(Story)
        .where(Story.user_id == user_id)
        .order_by(Story.is_primary.desc(), Story.created_at.desc())
    )
    return list(result.scalars().all())


async def get_primary_for_user(db: AsyncSession, user_id: UUID) -> Story | None:
    """Get the primary story for a user."""
    result = await db.execute(
        select(Story).where(
            and_(
                Story.user_id == user_id,
                Story.is_primary == True,  # noqa: E712
            )
        )
    )
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    user_id: UUID,
    name: str,
    content: str,
    is_primary: bool = False,
) -> Story:
    """Create a new story."""
    story = Story(
        user_id=user_id,
        name=name,
        content=content,
        is_primary=is_primary,
    )
    db.add(story)
    await db.flush()
    await db.refresh(story)
    return story


async def update(
    db: AsyncSession,
    *,
    db_story: Story,
    update_data: dict,
) -> Story:
    """Update a story."""
    for field, value in update_data.items():
        setattr(db_story, field, value)

    db.add(db_story)
    await db.flush()
    await db.refresh(db_story)
    return db_story


async def set_primary(
    db: AsyncSession,
    user_id: UUID,
    story_id: UUID,
) -> Story | None:
    """Set a story as primary, unsetting any other primary.
    
    Returns the updated story, or None if not found.
    """
    # First, unset all primary for this user
    stories = await get_by_user_id(db, user_id)
    for story in stories:
        if story.is_primary and story.id != story_id:
            story.is_primary = False
            db.add(story)

    # Set the new primary
    target_story = await get_by_id(db, story_id)
    if target_story and target_story.user_id == user_id:
        target_story.is_primary = True
        db.add(target_story)
        await db.flush()
        await db.refresh(target_story)
        return target_story

    return None


async def delete(db: AsyncSession, story_id: UUID) -> Story | None:
    """Delete a story by ID."""
    story = await get_by_id(db, story_id)
    if story:
        await db.delete(story)
        await db.flush()
    return story


async def delete_by_user_id(db: AsyncSession, user_id: UUID) -> int:
    """Delete all stories for a user. Returns count of deleted stories."""
    stories = await get_by_user_id(db, user_id)
    count = len(stories)
    for story in stories:
        await db.delete(story)
    await db.flush()
    return count

