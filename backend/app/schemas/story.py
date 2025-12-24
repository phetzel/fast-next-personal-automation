"""Story schemas for API request/response handling."""

from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema, TimestampSchema


class StoryBase(BaseSchema):
    """Base story schema with common fields."""

    name: str = Field(
        min_length=1,
        max_length=100,
        description="User-friendly name for the story",
    )


class StoryCreate(StoryBase):
    """Schema for creating a story."""

    content: str = Field(
        min_length=1,
        max_length=50000,
        description="The story content (markdown supported)",
    )
    is_primary: bool = Field(
        default=False,
        description="Whether to set as the primary story",
    )


class StoryUpdate(BaseSchema):
    """Schema for updating a story."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    content: str | None = Field(default=None, min_length=1, max_length=50000)
    is_primary: bool | None = None


class StoryResponse(StoryBase, TimestampSchema):
    """Schema for reading a story (API response)."""

    id: UUID
    user_id: UUID
    content: str
    is_primary: bool


class StorySummary(BaseSchema):
    """Abbreviated story info for lists and selectors."""

    id: UUID
    name: str
    is_primary: bool
    content_preview: str = Field(description="First 100 characters of content")
