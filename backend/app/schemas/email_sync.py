"""Schemas for email sync operations."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class EmailSyncCreate(BaseModel):
    """Input for triggering a new email sync."""

    force_full_sync: bool = Field(
        default=False,
        description="If true, syncs all emails regardless of last_sync_at.",
    )


class EmailSyncResponse(BaseModel):
    """Response schema for email sync."""

    id: UUID
    user_id: UUID
    started_at: datetime
    completed_at: datetime | None
    status: str
    error_message: str | None
    sources_synced: int
    emails_fetched: int
    emails_processed: int
    sync_metadata: dict | None = None

    model_config = {"from_attributes": True}


class EmailSyncListResponse(BaseModel):
    """Paginated list of email syncs."""

    items: list[EmailSyncResponse]
    total: int
    limit: int
    offset: int


class EmailSyncDetailResponse(EmailSyncResponse):
    """Detailed sync response with breakdown."""

    # Extended stats from sync_metadata
    jobs_extracted: int = 0
    jobs_saved: int = 0
    high_scoring_jobs: int = 0

    @classmethod
    def from_sync(cls, sync: "EmailSyncResponse") -> "EmailSyncDetailResponse":
        """Create detailed response from sync with sync_metadata extraction."""
        sync_metadata = sync.sync_metadata or {}
        return cls(
            id=sync.id,
            user_id=sync.user_id,
            started_at=sync.started_at,
            completed_at=sync.completed_at,
            status=sync.status,
            error_message=sync.error_message,
            sources_synced=sync.sources_synced,
            emails_fetched=sync.emails_fetched,
            emails_processed=sync.emails_processed,
            sync_metadata=sync.sync_metadata,
            jobs_extracted=sync_metadata.get("jobs_extracted", 0),
            jobs_saved=sync_metadata.get("jobs_saved", 0),
            high_scoring_jobs=sync_metadata.get("high_scoring", 0),
        )


class EmailSyncResult(BaseModel):
    """Result returned after triggering a sync."""

    sync_id: UUID
    status: str
    message: str
