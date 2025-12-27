"""JobProfile schemas for API request/response handling."""

from typing import Any, Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema, TimestampSchema


class JobProfileBase(BaseSchema):
    """Base job profile schema with common fields."""

    name: str = Field(
        default="Default Profile",
        min_length=1,
        max_length=100,
        description="Profile name for identification",
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
    # Contact info for cover letters
    contact_full_name: str | None = Field(
        default=None,
        max_length=255,
        description="Full name for cover letter header (e.g., 'Phillip Hetzel')",
    )
    contact_phone: str | None = Field(
        default=None,
        max_length=50,
        description="Phone number for cover letter header (e.g., '510-684-9802')",
    )
    contact_email: str | None = Field(
        default=None,
        max_length=255,
        description="Email for cover letter header (e.g., 'phetzel89@gmail.com')",
    )
    contact_location: str | None = Field(
        default=None,
        max_length=255,
        description="Location for cover letter header (e.g., 'Portland, Oregon')",
    )
    contact_website: str | None = Field(
        default=None,
        max_length=255,
        description="Website for cover letter header (e.g., 'philliphetzel.com')",
    )


class JobProfileCreate(JobProfileBase):
    """Schema for creating a job profile."""

    is_default: bool = Field(
        default=False,
        description="Whether this should be the default profile",
    )
    resume_id: UUID | None = Field(
        default=None,
        description="ID of the resume to link to this profile",
    )
    story_id: UUID | None = Field(
        default=None,
        description="ID of the story to link to this profile",
    )
    project_ids: list[UUID] | None = Field(
        default=None,
        description="IDs of projects to link to this profile",
    )


class JobProfileUpdate(BaseSchema):
    """Schema for updating a job profile.

    All fields are optional to allow partial updates.
    """

    name: str | None = Field(default=None, min_length=1, max_length=100)
    resume_id: UUID | None = None
    story_id: UUID | None = None
    project_ids: list[UUID] | None = None
    target_roles: list[str] | None = None
    target_locations: list[str] | None = None
    min_score_threshold: float | None = Field(default=None, ge=0.0, le=10.0)
    preferences: dict[str, Any] | None = None
    is_default: bool | None = None
    # Contact info for cover letters
    contact_full_name: str | None = Field(default=None, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=50)
    contact_email: str | None = Field(default=None, max_length=255)
    contact_location: str | None = Field(default=None, max_length=255)
    contact_website: str | None = Field(default=None, max_length=255)


class ResumeInfo(BaseSchema):
    """Embedded resume info in profile response."""

    id: UUID
    name: str
    original_filename: str
    has_text: bool


class StoryInfo(BaseSchema):
    """Embedded story info in profile response."""

    id: UUID
    name: str


class ProjectInfo(BaseSchema):
    """Embedded project info in profile response."""

    id: UUID
    name: str
    has_text: bool


class JobProfileResponse(JobProfileBase, TimestampSchema):
    """Schema for reading a job profile (API response)."""

    id: UUID
    user_id: UUID
    is_default: bool = Field(description="Whether this is the user's default profile")
    resume_id: UUID | None = Field(default=None, description="ID of the linked resume")
    resume: ResumeInfo | None = Field(default=None, description="Linked resume details")
    story_id: UUID | None = Field(default=None, description="ID of the linked story")
    story: StoryInfo | None = Field(default=None, description="Linked story details")
    project_ids: list[UUID] | None = Field(default=None, description="IDs of linked projects")
    projects: list[ProjectInfo] | None = Field(default=None, description="Linked project details")


class JobProfileSummary(BaseSchema):
    """Abbreviated profile info for lists and status checks."""

    id: UUID
    name: str
    is_default: bool = False
    has_resume: bool = False
    resume_name: str | None = None
    has_story: bool = False
    story_name: str | None = None
    project_count: int = 0
    target_roles_count: int = 0
    min_score_threshold: float = 7.0


class ProfileRequiredError(BaseSchema):
    """Structured error returned when profile selection is required.

    This error provides the frontend with information needed to show
    a profile selector instead of a generic error message.
    """

    error_type: Literal["profile_required"] = Field(
        default="profile_required",
        description="Error type identifier for frontend handling",
    )
    message: str = Field(
        description="Human-readable error message",
    )
    available_profiles: list[JobProfileSummary] = Field(
        default_factory=list,
        description="List of available profiles the user can select from",
    )
    create_profile_url: str = Field(
        default="/jobs/profiles",
        description="URL to create a new profile",
    )
