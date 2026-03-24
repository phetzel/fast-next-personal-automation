"""Schemas for read-only email triage."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

EmailBucket = Literal["now", "jobs", "finance", "newsletter", "notifications", "review", "done"]
TriageStatus = Literal["pending", "classified", "reviewed", "ignored"]


class EmailTriageRunInput(BaseModel):
    """Input payload for the email triage pipeline."""

    source_id: UUID | None = Field(
        default=None,
        description="Specific email source to triage. If omitted, triage all active sources.",
    )
    force_full_run: bool = Field(
        default=False,
        description="If true, reclassify messages even if they already have triage data.",
    )
    lookback_hours: int | None = Field(
        default=None,
        ge=1,
        le=720,
        description="Override the initial lookback window in hours for this run.",
    )
    limit_per_source: int = Field(
        default=250,
        ge=1,
        le=500,
        description="Maximum number of Gmail messages to fetch per source.",
    )


class EmailTriageRunResult(BaseModel):
    """Output payload for the email triage pipeline."""

    messages_scanned: int = 0
    messages_triaged: int = 0
    bucket_counts: dict[str, int] = Field(default_factory=dict)
    sources_processed: int = 0
    errors: list[str] = Field(default_factory=list)


class EmailTriageMessageResponse(BaseModel):
    """Response schema for a triaged email message."""

    id: UUID
    source_id: UUID
    source_email_address: str
    sync_id: UUID | None = None
    gmail_message_id: str
    gmail_thread_id: str | None = None
    subject: str | None = None
    from_address: str
    to_address: str | None = None
    received_at: datetime | None = None
    processed_at: datetime | None = None
    processing_error: str | None = None
    bucket: EmailBucket | None = None
    triage_status: TriageStatus
    triage_confidence: float | None = None
    actionability_score: float | None = None
    summary: str | None = None
    requires_review: bool
    unsubscribe_candidate: bool
    archive_recommended: bool
    is_vip: bool
    triaged_at: datetime | None = None
    last_action_at: datetime | None = None


class EmailTriageListResponse(BaseModel):
    """Paginated list of triaged email messages."""

    items: list[EmailTriageMessageResponse]
    total: int
    limit: int
    offset: int


class EmailTriageLastRunResponse(BaseModel):
    """Summary of the latest successful triage pipeline run."""

    id: UUID
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    messages_scanned: int = 0
    messages_triaged: int = 0
    bucket_counts: dict[str, int] = Field(default_factory=dict)


class EmailTriageStatsResponse(BaseModel):
    """Aggregate stats for the triage queue."""

    by_bucket: dict[str, int] = Field(default_factory=dict)
    total_triaged: int = 0
    review_count: int = 0
    unsubscribe_count: int = 0
    last_run: EmailTriageLastRunResponse | None = None


class EmailTriageReviewInput(BaseModel):
    """User review decision for a triaged message."""

    decision: Literal["reviewed", "ignored"]
    bucket: EmailBucket | None = None
    reason: str | None = Field(default=None, max_length=500)


class EmailTriageReviewResponse(BaseModel):
    """Response after a triage review decision is saved."""

    message: EmailTriageMessageResponse
