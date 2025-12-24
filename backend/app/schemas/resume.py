"""Resume schemas for API request/response handling."""

from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema, TimestampSchema


class ResumeBase(BaseSchema):
    """Base resume schema with common fields."""

    name: str = Field(
        min_length=1,
        max_length=100,
        description="User-friendly name for the resume",
    )


class ResumeCreate(ResumeBase):
    """Schema for creating a resume (internal use)."""

    original_filename: str
    file_path: str
    file_size: int
    mime_type: str
    text_content: str | None = None
    is_primary: bool = False


class ResumeUpdate(BaseSchema):
    """Schema for updating a resume."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_primary: bool | None = None


class ResumeResponse(ResumeBase, TimestampSchema):
    """Schema for reading a resume (API response)."""

    id: UUID
    user_id: UUID
    original_filename: str
    file_size: int
    mime_type: str
    is_primary: bool
    has_text: bool = Field(description="Whether text was extracted from the file")


class ResumeSummary(BaseSchema):
    """Abbreviated resume info for lists and selectors."""

    id: UUID
    name: str
    original_filename: str
    is_primary: bool
    has_text: bool


class ResumeTextResponse(BaseSchema):
    """Response containing resume text content."""

    id: UUID
    name: str
    text_content: str | None

