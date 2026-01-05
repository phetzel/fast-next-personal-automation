"""Unified job data models for all stages of job ingestion.

These models represent job data as it flows through the system:
- Scraped from job boards (ScrapedJob)
- Extracted from emails (ExtractedJob)
- Prepared for database ingestion (RawJob)

All three models share a common base (JobData) to reduce duplication.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class JobData(BaseModel):
    """Base job data structure shared across all stages.

    This is the canonical representation of job data before it hits the database.
    """

    title: str = Field(description="Job title")
    company: str = Field(description="Company name")
    job_url: str = Field(description="URL to the job listing")
    location: str | None = Field(default=None, description="Job location")
    description: str | None = Field(default=None, description="Job description or snippet")
    salary_range: str | None = Field(default=None, description="Salary range if available")
    source: str | None = Field(
        default=None, description="Source platform (linkedin, indeed, glassdoor, etc.)"
    )

    def to_dict(self) -> dict:
        """Convert to dictionary for database operations."""
        return self.model_dump(exclude_none=True)


class ScrapedJob(JobData):
    """Job data scraped from job boards.

    Contains additional metadata available from active scraping.
    """

    date_posted: datetime | None = Field(default=None, description="When the job was posted")
    is_remote: bool | None = Field(default=None, description="Whether the job is remote")
    job_type: str | None = Field(
        default=None, description="Job type (fulltime, parttime, internship, contract)"
    )
    company_url: str | None = Field(default=None, description="Company page URL")


class ExtractedJob(JobData):
    """Job data extracted from email alerts.

    Typically has less detail than scraped jobs since emails contain summaries.
    """

    description_snippet: str | None = Field(
        default=None, description="Brief description snippet from email"
    )

    @property
    def description(self) -> str | None:  # type: ignore[override]
        """Alias description_snippet as description for compatibility."""
        return self.description_snippet


class RawJob(ScrapedJob):
    """Unified job data structure for database ingestion.

    This is the final form before saving to the database.
    Can be created from either ScrapedJob or ExtractedJob.
    """

    @classmethod
    def from_scraped(cls, job: ScrapedJob) -> "RawJob":
        """Create from a ScrapedJob (job search pipeline)."""
        return cls(
            title=job.title,
            company=job.company,
            job_url=job.job_url,
            location=job.location,
            description=job.description,
            salary_range=job.salary_range,
            date_posted=job.date_posted,
            source=job.source,
            is_remote=job.is_remote,
            job_type=job.job_type,
            company_url=job.company_url,
        )

    @classmethod
    def from_extracted(cls, job: ExtractedJob, source_override: str | None = None) -> "RawJob":
        """Create from an ExtractedJob (email parser).

        Args:
            job: The extracted job from email.
            source_override: Optional override for the source field.
        """
        return cls(
            title=job.title,
            company=job.company,
            job_url=job.job_url,
            location=job.location,
            description=job.description_snippet,
            salary_range=job.salary_range,
            source=source_override or job.source,
        )
