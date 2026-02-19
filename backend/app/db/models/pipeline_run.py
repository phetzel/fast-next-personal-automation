"""Pipeline run database model for tracking execution history."""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class PipelineRunStatus(StrEnum):
    """Status of a pipeline run."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
    CANCELLED = "cancelled"


class PipelineTriggerType(StrEnum):
    """How the pipeline was triggered."""

    API = "api"  # Direct API call from frontend
    WEBHOOK = "webhook"  # Incoming webhook from external service
    AGENT = "agent"  # AI agent tool call
    CRON = "cron"  # Scheduled execution
    MANUAL = "manual"  # Manual trigger (e.g., admin panel)


class PipelineRun(Base, TimestampMixin):
    """Pipeline execution history model.

    Tracks every pipeline invocation with inputs, outputs, timing,
    and metadata for observability and debugging.
    """

    __tablename__ = "pipeline_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Pipeline identification
    pipeline_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Execution status
    status: Mapped[str] = mapped_column(
        String(20), default=PipelineRunStatus.PENDING.value, nullable=False, index=True
    )

    # Trigger information
    trigger_type: Mapped[str] = mapped_column(
        String(20), default=PipelineTriggerType.API.value, nullable=False, index=True
    )

    # Optional user association (null for webhooks, cron, etc.)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Input/Output data (stored as JSONB for flexibility)
    input_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Error information
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Additional context/metadata
    run_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Timing information
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationship to user (optional)
    user: Mapped["User | None"] = relationship(  # type: ignore[name-defined] # noqa: F821
        "User", foreign_keys=[user_id], lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<PipelineRun {self.id} pipeline={self.pipeline_name} status={self.status}>"
