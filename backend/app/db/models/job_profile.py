"""JobProfile database model for storing job preferences and resume."""

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.resume import Resume
    from app.db.models.story import Story
    from app.db.models.user import User


class JobProfile(Base, TimestampMixin):
    """JobProfile model for storing job-related user context.

    Contains target roles, locations, and preferences used by job-related
    pipelines for matching and scoring. Resume, story, and projects are
    linked to enable dynamic search and application customization.

    A user can have multiple profiles with different configurations.
    One profile can be marked as default for quick access.
    """

    __tablename__ = "job_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Profile identification
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="Default Profile")
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Resume reference (nullable - profile can exist without resume)
    resume_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Story reference (nullable - profile can exist without story)
    story_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Project IDs (stored as JSON array of UUID strings)
    project_ids: Mapped[list[str] | None] = mapped_column(
        JSON, nullable=True, default=list
    )  # ["uuid1", "uuid2", ...]

    # Target job criteria
    target_roles: Mapped[list[str] | None] = mapped_column(
        JSON, nullable=True, default=list
    )  # ["Backend Engineer", "Python Developer"]
    target_locations: Mapped[list[str] | None] = mapped_column(
        JSON, nullable=True, default=list
    )  # ["Remote", "San Francisco, CA"]

    # Scoring preferences
    min_score_threshold: Mapped[float] = mapped_column(Float, default=7.0, nullable=False)

    # Additional preferences (extensible)
    preferences: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True, default=dict
    )  # {"remote_only": true, "salary_min": 150000, ...}

    # Contact info for cover letters
    contact_full_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # "Phillip Hetzel"
    contact_phone: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "510-684-9802"
    contact_email: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # "phetzel89@gmail.com"
    contact_location: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # "Portland, Oregon"
    contact_website: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # "philliphetzel.com"

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    resume: Mapped["Resume | None"] = relationship("Resume", lazy="selectin")
    story: Mapped["Story | None"] = relationship("Story", lazy="selectin")

    def __repr__(self) -> str:
        return f"<JobProfile(id={self.id}, name={self.name}, user_id={self.user_id})>"
