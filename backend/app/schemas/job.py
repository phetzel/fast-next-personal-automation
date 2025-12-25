"""Job schemas for API request/response handling."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.db.models.job import JobStatus
from app.schemas.base import BaseSchema, TimestampSchema


class JobBase(BaseSchema):
    """Base job schema with common fields."""

    title: str = Field(max_length=500, description="Job title")
    company: str = Field(max_length=255, description="Company name")
    location: str | None = Field(default=None, max_length=255, description="Job location")
    description: str | None = Field(default=None, description="Job description")
    job_url: str = Field(max_length=2048, description="URL to job posting")
    salary_range: str | None = Field(
        default=None, max_length=100, description="Salary range if available"
    )
    date_posted: datetime | None = Field(default=None, description="When the job was posted")
    source: str | None = Field(
        default=None, max_length=50, description="Source (linkedin, indeed, etc.)"
    )


class JobCreate(JobBase):
    """Schema for creating a job (internal use by pipeline)."""

    relevance_score: float | None = Field(
        default=None, ge=0.0, le=10.0, description="AI-computed relevance score (0-10)"
    )
    reasoning: str | None = Field(default=None, description="AI reasoning for the score")
    search_terms: str | None = Field(
        default=None, max_length=500, description="Search terms used to find this job"
    )


class JobUpdate(BaseSchema):
    """Schema for updating a job.

    Users can update status, notes, and prep materials.
    """

    status: JobStatus | None = Field(default=None, description="Job status in workflow")
    notes: str | None = Field(default=None, description="User notes about the job")
    cover_letter: str | None = Field(default=None, description="Generated cover letter")
    prep_notes: str | None = Field(
        default=None, description="Prep notes (highlights + talking points)"
    )


class JobResponse(JobBase, TimestampSchema):
    """Schema for reading a job (API response)."""

    id: UUID
    user_id: UUID
    relevance_score: float | None = None
    reasoning: str | None = None
    status: JobStatus = JobStatus.NEW
    search_terms: str | None = None
    notes: str | None = None
    # Prep materials
    cover_letter: str | None = None
    cover_letter_file_path: str | None = None
    cover_letter_generated_at: datetime | None = None
    prep_notes: str | None = None
    prepped_at: datetime | None = None


class JobSummary(BaseSchema):
    """Abbreviated job info for lists and pipeline output."""

    id: UUID
    title: str
    company: str
    location: str | None = None
    relevance_score: float | None = None
    status: JobStatus = JobStatus.NEW
    job_url: str


class JobListResponse(BaseSchema):
    """Paginated list of jobs."""

    jobs: list[JobResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class JobStatsResponse(BaseSchema):
    """Statistics about user's jobs."""

    total: int = 0
    new: int = 0
    prepped: int = 0
    reviewed: int = 0
    applied: int = 0
    rejected: int = 0
    interviewing: int = 0
    avg_score: float | None = None
    high_scoring: int = 0  # Jobs with score >= 7.0


class JobFilters(BaseSchema):
    """Filters for querying jobs."""

    status: JobStatus | None = None
    source: str | None = None
    min_score: float | None = Field(default=None, ge=0.0, le=10.0)
    max_score: float | None = Field(default=None, ge=0.0, le=10.0)
    search: str | None = Field(default=None, description="Search in title, company, description")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort_by: Literal["created_at", "relevance_score", "date_posted", "company"] = "created_at"
    sort_order: Literal["asc", "desc"] = "desc"
