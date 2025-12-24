"""Story API routes.

Provides REST endpoints for managing user stories/narratives.
"""

import logging
from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, StorySvc
from app.schemas.story import (
    StoryCreate,
    StoryResponse,
    StorySummary,
    StoryUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=StoryResponse, status_code=201)
async def create_story(
    current_user: CurrentUser,
    story_service: StorySvc,
    data: StoryCreate,
) -> StoryResponse:
    """Create a new story.

    Stories are personal narratives that users can emphasize
    during job applications.
    """
    story = await story_service.create(
        user_id=current_user.id,
        data=data,
    )

    return StoryResponse(
        id=story.id,
        user_id=story.user_id,
        name=story.name,
        content=story.content,
        is_primary=story.is_primary,
        created_at=story.created_at,
        updated_at=story.updated_at,
    )


@router.get("", response_model=list[StorySummary])
async def list_stories(
    current_user: CurrentUser,
    story_service: StorySvc,
) -> list[StorySummary]:
    """List all stories for the current user.

    Returns stories ordered by primary status (primary first) then creation date.
    """
    stories = await story_service.list_for_user(current_user.id)
    return [
        StorySummary(
            id=s.id,
            name=s.name,
            is_primary=s.is_primary,
            content_preview=s.content[:100] + "..." if len(s.content) > 100 else s.content,
        )
        for s in stories
    ]


@router.get("/{story_id}", response_model=StoryResponse)
async def get_story(
    story_id: UUID,
    current_user: CurrentUser,
    story_service: StorySvc,
) -> StoryResponse:
    """Get details of a specific story."""
    story = await story_service.get_by_id(story_id, current_user.id)
    return StoryResponse(
        id=story.id,
        user_id=story.user_id,
        name=story.name,
        content=story.content,
        is_primary=story.is_primary,
        created_at=story.created_at,
        updated_at=story.updated_at,
    )


@router.patch("/{story_id}", response_model=StoryResponse)
async def update_story(
    story_id: UUID,
    update_data: StoryUpdate,
    current_user: CurrentUser,
    story_service: StorySvc,
) -> StoryResponse:
    """Update a story's name, content, or primary status."""
    story = await story_service.update(story_id, current_user.id, update_data)
    return StoryResponse(
        id=story.id,
        user_id=story.user_id,
        name=story.name,
        content=story.content,
        is_primary=story.is_primary,
        created_at=story.created_at,
        updated_at=story.updated_at,
    )


@router.delete("/{story_id}", response_model=StoryResponse)
async def delete_story(
    story_id: UUID,
    current_user: CurrentUser,
    story_service: StorySvc,
) -> StoryResponse:
    """Delete a story.

    If the deleted story was primary, another story will become primary.
    """
    story = await story_service.delete(story_id, current_user.id)
    return StoryResponse(
        id=story.id,
        user_id=story.user_id,
        name=story.name,
        content=story.content,
        is_primary=story.is_primary,
        created_at=story.created_at,
        updated_at=story.updated_at,
    )


@router.post("/{story_id}/set-primary", response_model=StoryResponse)
async def set_primary_story(
    story_id: UUID,
    current_user: CurrentUser,
    story_service: StorySvc,
) -> StoryResponse:
    """Set a story as the primary.

    Only one story can be primary at a time. Setting a new primary
    will unset any previous primary.
    """
    story = await story_service.set_primary(current_user.id, story_id)
    return StoryResponse(
        id=story.id,
        user_id=story.user_id,
        name=story.name,
        content=story.content,
        is_primary=story.is_primary,
        created_at=story.created_at,
        updated_at=story.updated_at,
    )

