"""Project schemas for API request/response handling."""

from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema, TimestampSchema


class ProjectBase(BaseSchema):
    """Base project schema with common fields."""

    name: str = Field(
        min_length=1,
        max_length=100,
        description="User-friendly name for the project",
    )


class ProjectCreate(ProjectBase):
    """Schema for creating a project (internal use)."""

    original_filename: str
    file_path: str
    file_size: int
    mime_type: str
    text_content: str | None = None
    is_active: bool = True


class ProjectUpdate(BaseSchema):
    """Schema for updating a project."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None


class ProjectResponse(ProjectBase, TimestampSchema):
    """Schema for reading a project (API response)."""

    id: UUID
    user_id: UUID
    original_filename: str
    file_size: int
    mime_type: str
    is_active: bool
    has_text: bool = Field(description="Whether text was extracted from the file")


class ProjectSummary(BaseSchema):
    """Abbreviated project info for lists."""

    id: UUID
    name: str
    original_filename: str
    is_active: bool
    has_text: bool


class ProjectTextResponse(BaseSchema):
    """Response containing project text content."""

    id: UUID
    name: str
    text_content: str | None
