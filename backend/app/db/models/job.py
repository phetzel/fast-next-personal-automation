"""Job database model for storing scraped and analyzed job listings."""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.user import User


class JobStatus(str, Enum):
    """Status of a job in the user's pipeline."""

    NEW = "new"
    REVIEWED = "reviewed"
    APPLIED = "applied"
    REJECTED = "rejected"
    INTERVIEWING = "interviewing"


class Job(Base, TimestampMixin):
    """Job model for storing scraped job listings with analysis results.

    Each job is associated with a user and contains the scraped job data
    plus AI-generated relevance scoring and reasoning.
    """

    __tablename__ = "jobs"
    __table_args__ = (
        # Prevent duplicate job URLs per user
        UniqueConstraint("user_id", "job_url", name="jobs_user_id_job_url_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Job details from scraping
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    salary_range: Mapped[str | None] = mapped_column(String(100), nullable=True)
    date_posted: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # linkedin, indeed, glassdoor, etc.

    # AI analysis results
    relevance_score: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)

    # User workflow status
    status: Mapped[str] = mapped_column(
        String(50), default=JobStatus.NEW.value, nullable=False, index=True
    )

    # Search metadata
    search_terms: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )  # Terms used to find this job

    # User notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationship
    user: Mapped["User"] = relationship("User", lazy="selectin")

    @property
    def job_status(self) -> JobStatus:
        """Get status as enum."""
        return JobStatus(self.status)

    def __repr__(self) -> str:
        return f"<Job(id={self.id}, title={self.title}, company={self.company}, score={self.relevance_score})>"
