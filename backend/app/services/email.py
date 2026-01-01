"""Email service.

Contains business logic for email operations including syncs, destinations, and routing.
"""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.email_destination import EmailDestination
from app.db.models.email_message import EmailMessage
from app.db.models.email_sync import EmailSync
from app.email.config import get_parser, get_parser_for_sender
from app.repositories import (
    email_destination_repo,
    email_source_repo,
    email_sync_repo,
)
from app.services.job import JobService, RawJob

logger = logging.getLogger(__name__)


# Default job board senders for the default destination
DEFAULT_JOB_SENDERS = [
    "indeed.com",
    "linkedin.com",
    "glassdoor.com",
    "dice.com",
    "ziprecruiter.com",
    "hiringcafe.com",
]


class EmailService:
    """Service for email-related business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # === Email Sync Operations ===

    async def get_sync_by_id(self, sync_id: UUID, user_id: UUID) -> EmailSync:
        """Get an email sync by ID."""
        sync = await email_sync_repo.get_by_id(self.db, sync_id)
        if sync is None or sync.user_id != user_id:
            raise NotFoundError(message="Email sync not found", details={"id": str(sync_id)})
        return sync

    async def list_syncs(
        self, user_id: UUID, limit: int = 50, offset: int = 0
    ) -> tuple[list[EmailSync], int]:
        """List email syncs for a user."""
        syncs = await email_sync_repo.get_by_user_id(self.db, user_id, limit, offset)
        total = await email_sync_repo.count_by_user_id(self.db, user_id)
        return syncs, total

    async def start_sync(self, user_id: UUID, force_full_sync: bool = False) -> EmailSync:
        """Start a new email sync operation.

        Returns the sync record (will be in 'running' status).
        The actual sync work should be done by the pipeline.
        """
        # First, cancel any syncs that have been running too long (10 min timeout)
        await email_sync_repo.cancel_stale_syncs(self.db, user_id, stale_minutes=10)

        # Check if there's already a running sync
        existing = await email_sync_repo.get_running_by_user(self.db, user_id)
        if existing:
            return existing

        # Create new sync record
        sync = await email_sync_repo.create(
            self.db,
            user_id=user_id,
            started_at=datetime.now(UTC),
            status="running",
        )

        return sync

    async def complete_sync(
        self,
        sync: EmailSync,
        sources_synced: int,
        emails_fetched: int,
        emails_processed: int,
        sync_metadata: dict[str, Any] | None = None,
        error_message: str | None = None,
    ) -> EmailSync:
        """Mark a sync as completed with final stats."""
        return await email_sync_repo.complete(
            self.db,
            sync,
            sources_synced=sources_synced,
            emails_fetched=emails_fetched,
            emails_processed=emails_processed,
            sync_metadata=sync_metadata,
            error_message=error_message,
        )

    # === Email Destination Operations ===

    async def get_destination_by_id(self, destination_id: UUID, user_id: UUID) -> EmailDestination:
        """Get an email destination by ID."""
        destination = await email_destination_repo.get_by_id(self.db, destination_id)
        if destination is None or destination.user_id != user_id:
            raise NotFoundError(
                message="Email destination not found", details={"id": str(destination_id)}
            )
        return destination

    async def list_destinations(self, user_id: UUID) -> list[EmailDestination]:
        """List email destinations for a user."""
        return await email_destination_repo.get_by_user_id(self.db, user_id)

    async def create_destination(
        self,
        user_id: UUID,
        name: str,
        destination_type: str = "jobs",
        filter_rules: dict | None = None,
        parser_name: str | None = None,
        is_active: bool = True,
        priority: int = 0,
    ) -> EmailDestination:
        """Create a new email destination."""
        return await email_destination_repo.create(
            self.db,
            user_id=user_id,
            name=name,
            destination_type=destination_type,
            filter_rules=filter_rules,
            parser_name=parser_name,
            is_active=is_active,
            priority=priority,
        )

    async def update_destination(
        self,
        destination_id: UUID,
        user_id: UUID,
        **kwargs,
    ) -> EmailDestination:
        """Update an email destination."""
        destination = await self.get_destination_by_id(destination_id, user_id)
        return await email_destination_repo.update(self.db, destination, **kwargs)

    async def delete_destination(self, destination_id: UUID, user_id: UUID) -> None:
        """Delete an email destination."""
        destination = await self.get_destination_by_id(destination_id, user_id)
        await email_destination_repo.delete(self.db, destination)

    async def ensure_default_destination(self, user_id: UUID) -> EmailDestination:
        """Ensure the user has a default 'Job Alerts' destination.

        Creates one if it doesn't exist.
        """
        destinations = await email_destination_repo.get_by_user_id(self.db, user_id)

        # Check if any destination already handles jobs
        for dest in destinations:
            if dest.destination_type == "jobs":
                return dest

        # Create default job alerts destination
        return await email_destination_repo.create(
            self.db,
            user_id=user_id,
            name="Job Alerts",
            destination_type="jobs",
            filter_rules={
                "sender_patterns": DEFAULT_JOB_SENDERS,
            },
            parser_name=None,  # Auto-detect
            is_active=True,
            priority=0,
        )

    # === Email Message Operations ===

    async def list_messages(
        self, user_id: UUID, limit: int = 100, source_id: UUID | None = None
    ) -> list[EmailMessage]:
        """List email messages for a user."""
        if source_id:
            # Verify source belongs to user
            source = await email_source_repo.get_by_id(self.db, source_id)
            if source is None or source.user_id != user_id:
                raise NotFoundError(
                    message="Email source not found", details={"id": str(source_id)}
                )
            return await email_source_repo.get_messages_by_source(self.db, source_id, limit)

        # Get all messages across all user's sources
        sources = await email_source_repo.get_by_user_id(self.db, user_id)
        all_messages: list[EmailMessage] = []
        for source in sources:
            messages = await email_source_repo.get_messages_by_source(self.db, source.id, limit)
            all_messages.extend(messages)

        # Sort by processed_at descending and limit
        all_messages.sort(key=lambda m: m.processed_at or datetime.min, reverse=True)
        return all_messages[:limit]

    async def get_message_with_destinations(
        self, message_id: UUID, user_id: UUID
    ) -> tuple[EmailMessage, list]:
        """Get a message with its destination processing records."""
        from sqlalchemy import select

        result = await self.db.execute(select(EmailMessage).where(EmailMessage.id == message_id))
        message = result.scalar_one_or_none()

        if message is None:
            raise NotFoundError(message="Email message not found", details={"id": str(message_id)})

        # Verify user owns this message via source
        source = await email_source_repo.get_by_id(self.db, message.source_id)
        if source is None or source.user_id != user_id:
            raise NotFoundError(message="Email message not found", details={"id": str(message_id)})

        destinations = await email_destination_repo.get_message_destinations(self.db, message_id)
        return message, destinations

    # === Routing Logic ===

    async def find_matching_destinations(
        self, user_id: UUID, from_address: str, subject: str | None
    ) -> list[EmailDestination]:
        """Find all destinations that match an email."""
        return await email_destination_repo.find_matching_destinations(
            self.db, user_id, from_address, subject
        )

    async def process_email_for_destination(
        self,
        message: EmailMessage,
        destination: EmailDestination,
        email_content: dict,
        job_service: JobService,
        profile_id: UUID | None = None,
        resume_text: str | None = None,
        target_roles: list[str] | None = None,
        min_score: float = 7.0,
    ) -> dict[str, Any]:
        """Process an email for a specific destination.

        Returns processing results including items extracted.
        """
        results: dict[str, Any] = {
            "items_extracted": 0,
            "parser_used": None,
            "error": None,
            "created_item_ids": [],
        }

        try:
            if destination.destination_type == "jobs":
                # Determine parser
                if destination.parser_name:
                    parser_name = destination.parser_name
                    source_name = destination.parser_name.capitalize()
                else:
                    parser_name, source_name = get_parser_for_sender(message.from_address)

                results["parser_used"] = parser_name
                parser = get_parser(parser_name)

                # Parse email
                extracted_jobs = await parser.parse(
                    subject=email_content.get("subject", ""),
                    body_html=email_content.get("body_html", ""),
                    body_text=email_content.get("body_text", ""),
                )
                results["items_extracted"] = len(extracted_jobs)

                # Convert to RawJob format and ingest
                if extracted_jobs:
                    raw_jobs = [
                        RawJob.from_extracted(job, source_override=source_name.lower())
                        for job in extracted_jobs
                    ]

                    # Get user_id from the source
                    source = await email_source_repo.get_by_id(self.db, message.source_id)
                    if source:
                        ingestion = await job_service.ingest_jobs(
                            user_id=source.user_id,
                            jobs=raw_jobs,
                            ingestion_source="email",
                            profile_id=profile_id,
                            resume_text=resume_text,
                            target_roles=target_roles,
                            min_score=min_score,
                            save_all=True,
                        )
                        # Store created job IDs
                        if ingestion.saved_jobs:
                            results["created_item_ids"] = [
                                str(job.id) for job in ingestion.saved_jobs
                            ]

        except Exception as e:
            logger.exception(f"Error processing email for destination {destination.id}: {e}")
            results["error"] = str(e)

        return results

    async def record_destination_processing(
        self,
        message_id: UUID,
        destination_id: UUID,
        parser_used: str | None,
        items_extracted: int,
        processing_error: str | None = None,
        created_item_ids: list[str] | None = None,
    ) -> Any:
        """Record that a message was processed by a destination."""
        return await email_destination_repo.create_message_destination(
            self.db,
            message_id=message_id,
            destination_id=destination_id,
            processed_at=datetime.now(UTC),
            parser_used=parser_used,
            items_extracted=items_extracted,
            processing_error=processing_error,
            created_item_ids=created_item_ids,
        )
