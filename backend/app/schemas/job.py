"""Job schemas for API request/response handling."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.db.models.job import JobStatus
from app.schemas.base import BaseSchema, TimestampSchema
from app.schemas.linked_email import LinkedEmailContext

# Application type literals
ApplicationType = Literal["easy_apply", "ats", "direct", "email", "unknown"]
IngestionSource = Literal["scrape", "email", "manual", "openclaw"]


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
    ingestion_source: IngestionSource | None = Field(
        default=None,
        max_length=20,
        description="How job was discovered (scrape, email, manual, openclaw)",
    )
    is_remote: bool | None = Field(default=None, description="Whether the job is remote")
    job_type: str | None = Field(
        default=None,
        max_length=50,
        description="Job type (fulltime, parttime, internship, contract)",
    )
    company_url: str | None = Field(
        default=None, max_length=2048, description="URL to company page"
    )


class JobCreate(JobBase):
    """Schema for creating a job (internal use by pipeline)."""

    profile_id: UUID | None = Field(
        default=None,
        description="Optional profile to reuse later as prep context",
    )
    relevance_score: float | None = Field(
        default=None, ge=0.0, le=10.0, description="AI-computed relevance score (0-10)"
    )
    reasoning: str | None = Field(default=None, description="AI reasoning for the score")
    search_terms: str | None = Field(
        default=None, max_length=500, description="Search terms used to find this job"
    )


class ManualJobCreateRequest(JobBase):
    """Schema for manually creating a job with optional prep-profile context."""

    profile_id: UUID | None = Field(
        default=None,
        description="Optional profile to associate for later prep",
    )
    notes: str | None = Field(default=None, description="Optional notes for the job")


class ManualAnalyzeRequest(BaseSchema):
    """Schema for manually marking a job ready for prep."""

    requires_cover_letter: bool = Field(
        default=False,
        description="Whether this application needs a cover letter",
    )
    screening_questions: list[str] = Field(
        default_factory=list,
        description="Optional custom questions to prepare answers for",
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
    profile_id: UUID | None = None
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
    # Application analysis
    application_type: ApplicationType | None = None
    application_url: str | None = None
    requires_cover_letter: bool | None = None
    cover_letter_requested: bool | None = None
    requires_resume: bool | None = None
    detected_fields: dict[str, Any] | None = None
    screening_questions: list[dict[str, Any]] | None = None
    screening_answers: dict[str, str] | None = None
    ats_family: str | None = None
    analysis_source: str | None = None
    analyzed_at: datetime | None = None
    has_application_analysis: bool = False
    is_prep_eligible: bool = False
    # Application submission
    applied_at: datetime | None = None
    application_method: str | None = None
    confirmation_code: str | None = None
    # Linked email context
    linked_email: LinkedEmailContext | None = None

    @model_validator(mode="before")
    @classmethod
    def _resolve_linked_email(cls, data: Any) -> Any:
        """Build linked_email from the source_email_message relationship."""
        if isinstance(data, dict):
            return data
        msg = getattr(data, "source_email_message", None)
        if msg is not None and not hasattr(data, "linked_email"):
            source = getattr(msg, "source", None)
            object.__setattr__(
                data,
                "linked_email",
                LinkedEmailContext(
                    id=msg.id,
                    source_email_address=source.email_address if source else "",
                    gmail_message_id=msg.gmail_message_id,
                    gmail_thread_id=msg.gmail_thread_id,
                    subject=msg.subject,
                    from_address=msg.from_address,
                    received_at=msg.received_at,
                    bucket=msg.bucket,
                    summary=msg.summary,
                ),
            )
        return data


class JobSummary(BaseSchema):
    """Abbreviated job info for lists and pipeline output."""

    id: UUID
    title: str
    company: str
    location: str | None = None
    relevance_score: float | None = None
    status: JobStatus = JobStatus.NEW
    job_url: str
    source: str | None = None
    ingestion_source: str | None = None


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
    analyzed: int = 0
    prepped: int = 0
    reviewed: int = 0
    applied: int = 0
    interviewing: int = 0
    rejected: int = 0
    avg_score: float | None = None
    high_scoring: int = 0  # Jobs with score >= 7.0


class JobFilters(BaseSchema):
    """Filters for querying jobs."""

    status: JobStatus | None = None
    statuses: list[JobStatus] | None = None
    source: str | None = None
    ingestion_source: IngestionSource | None = Field(
        default=None,
        description="Filter by how job was discovered (scrape, email, manual, openclaw)",
    )
    min_score: float | None = Field(default=None, ge=0.0, le=10.0)
    max_score: float | None = Field(default=None, ge=0.0, le=10.0)
    search: str | None = Field(default=None, description="Search in title, company, description")
    prep_eligible: bool | None = Field(
        default=None,
        description="Filter to jobs explicitly analyzed and eligible for prep",
    )
    posted_within_hours: int | None = Field(
        default=None,
        ge=1,
        description="Filter to jobs posted within the last N hours (e.g., 24, 48, 72)",
    )
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort_by: Literal["created_at", "relevance_score", "date_posted", "company"] = "created_at"
    sort_order: Literal["asc", "desc"] = "desc"
