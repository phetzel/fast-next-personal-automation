"""UserProfile schemas for API request/response handling."""

from typing import Any
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema, TimestampSchema


class UserProfileBase(BaseSchema):
    """Base user profile schema with common fields."""

    resume_text: str | None = Field(
        default=None, description="User's resume/CV text content"
    )
    target_roles: list[str] | None = Field(
        default=None,
        description="Target job roles (e.g., ['Backend Engineer', 'Python Developer'])",
    )
    target_locations: list[str] | None = Field(
        default=None,
        description="Target locations (e.g., ['Remote', 'San Francisco, CA'])",
    )
    min_score_threshold: float = Field(
        default=7.0,
        ge=0.0,
        le=10.0,
        description="Minimum relevance score to save jobs (0-10)",
    )
    preferences: dict[str, Any] | None = Field(
        default=None,
        description="Additional preferences (remote_only, salary_min, etc.)",
    )


class UserProfileCreate(UserProfileBase):
    """Schema for creating a user profile."""

    pass


class UserProfileUpdate(BaseSchema):
    """Schema for updating a user profile.

    All fields are optional to allow partial updates.
    """

    resume_text: str | None = None
    target_roles: list[str] | None = None
    target_locations: list[str] | None = None
    min_score_threshold: float | None = Field(default=None, ge=0.0, le=10.0)
    preferences: dict[str, Any] | None = None


class UserProfileResponse(UserProfileBase, TimestampSchema):
    """Schema for reading a user profile (API response)."""

    id: UUID
    user_id: UUID


class UserProfileSummary(BaseSchema):
    """Abbreviated profile info for status checks."""

    has_profile: bool = False
    has_resume: bool = False
    target_roles_count: int = 0
    min_score_threshold: float = 7.0

