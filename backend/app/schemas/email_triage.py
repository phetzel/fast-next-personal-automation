"""Schemas for read-only email triage."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

EmailBucket = Literal["now", "jobs", "finance", "newsletter", "notifications", "review", "done"]
TriageStatus = Literal["pending", "classified", "reviewed", "ignored", "actioned"]
EmailActionType = Literal["archive", "mark_read", "trash", "label", "undo"]


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
    # Phase 3 routing counts
    routed_job_messages: int = 0
    created_jobs: int = 0
    routed_finance_messages: int = 0
    imported_transactions: int = 0
    routing_errors: int = 0
    # Phase 4 auto-action counts
    auto_archived: int = 0
    auto_labeled: int = 0
    auto_marked_read: int = 0
    auto_action_errors: int = 0
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


# --- Phase 4: Action schemas ---


class EmailActionInput(BaseModel):
    """Request to execute a Gmail action on a message."""

    action: EmailActionType
    label_name: str | None = Field(
        default=None,
        description="Gmail label name to apply (only for 'label' action).",
    )


class EmailActionResponse(BaseModel):
    """Response after a Gmail action is executed."""

    message: EmailTriageMessageResponse
    action_log_id: UUID
    action_type: str
    action_status: str


class EmailBulkActionInput(BaseModel):
    """Bulk action on multiple messages."""

    message_ids: list[UUID] = Field(..., min_length=1, max_length=100)
    action: Literal["archive", "mark_read"]


class EmailBulkActionResponse(BaseModel):
    """Response after a bulk Gmail action."""

    succeeded: int = 0
    failed: int = 0
    action_log_ids: list[UUID] = Field(default_factory=list)


class EmailSourceAutoActionSettings(BaseModel):
    """Auto-action settings for an email source."""

    auto_actions_enabled: bool
    auto_action_confidence_threshold: float = Field(ge=0.5, le=1.0)
