"""Scheduled task database model for dynamic pipeline scheduling."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class ScheduledTask(Base, TimestampMixin):
    """Scheduled task model for calendar-based pipeline scheduling.

    Stores cron-based schedules for pipelines that can be managed
    via the frontend calendar interface.
    """

    __tablename__ = "scheduled_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Task identification
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pipeline to execute
    pipeline_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Cron expression (e.g., "0 9 * * 1" for every Monday at 9am)
    cron_expression: Mapped[str] = mapped_column(String(100), nullable=False)

    # Optional timezone for the cron schedule (default UTC)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC")

    # Whether the schedule is active
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    # User who created/owns this schedule
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Input parameters for the pipeline (stored as JSONB)
    input_params: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Scheduling metadata
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Optional color for calendar display
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Relationship to user
    user: Mapped["User"] = relationship(  # type: ignore[name-defined] # noqa: F821
        "User", foreign_keys=[user_id], lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<ScheduledTask {self.id} name={self.name} pipeline={self.pipeline_name} cron={self.cron_expression}>"
