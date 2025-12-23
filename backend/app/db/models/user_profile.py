"""UserProfile database model for storing user resume and job search preferences."""

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.user import User


class UserProfile(Base, TimestampMixin):
    """UserProfile model for storing job search context.

    Contains the user's resume, target roles, locations, and preferences
    used by the job search pipeline for matching and scoring.
    """

    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Resume/CV content
    resume_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Target job criteria
    target_roles: Mapped[list[str] | None] = mapped_column(
        JSON, nullable=True, default=list
    )  # ["Backend Engineer", "Python Developer"]
    target_locations: Mapped[list[str] | None] = mapped_column(
        JSON, nullable=True, default=list
    )  # ["Remote", "San Francisco, CA"]

    # Scoring preferences
    min_score_threshold: Mapped[float] = mapped_column(
        Float, default=7.0, nullable=False
    )

    # Additional preferences (extensible)
    preferences: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True, default=dict
    )  # {"remote_only": true, "salary_min": 150000, ...}

    # Relationship
    user: Mapped["User"] = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<UserProfile(id={self.id}, user_id={self.user_id})>"

