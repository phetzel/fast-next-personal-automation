"""Email Sync Pipeline.

Syncs job listings from connected email accounts.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import ClassVar
from uuid import UUID

from pydantic import BaseModel, Field

from app.clients.gmail import GmailClient
from app.core.config import settings
from app.db.session import get_db_context
from app.email.config import get_default_sender_domains, get_parser, get_parser_for_sender
from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.registry import register_pipeline
from app.repositories import email_source_repo, job_repo

logger = logging.getLogger(__name__)


class EmailSyncInput(BaseModel):
    """Input for email sync pipeline."""

    source_id: UUID | None = Field(
        default=None,
        description="Specific email source to sync. If not provided, syncs all active sources.",
    )
    force_full_sync: bool = Field(
        default=False,
        description="If true, ignores last_sync_at and syncs all matching emails.",
    )


class EmailSyncOutput(BaseModel):
    """Output from email sync pipeline."""

    emails_processed: int = Field(default=0, description="Number of emails processed")
    jobs_extracted: int = Field(default=0, description="Total jobs extracted from emails")
    jobs_saved: int = Field(default=0, description="New jobs saved (after deduplication)")
    sources_synced: int = Field(default=0, description="Number of email sources synced")
    errors: list[str] = Field(default_factory=list, description="Any errors encountered")


@register_pipeline
class EmailSyncJobsPipeline(ActionPipeline[EmailSyncInput, EmailSyncOutput]):
    """Email sync pipeline that fetches and parses job alert emails.

    This pipeline:
    1. Connects to Gmail via OAuth
    2. Fetches emails from known job board senders
    3. Parses emails using template or AI parsers
    4. Creates new Job records (deduplicating by URL)
    5. Records processed emails to avoid re-processing

    Prerequisites:
    - User must have a connected Gmail account (EmailSource)

    Can be invoked via:
    - API: POST /api/v1/pipelines/email_sync_jobs/execute
    - Scheduled task: Every hour for all active sources
    - Manual trigger: POST /api/v1/email/sources/{id}/sync
    """

    name = "email_sync_jobs"
    description = "Sync job listings from email alerts"
    tags: ClassVar[list[str]] = ["email", "jobs"]
    area: ClassVar[str | None] = "jobs"

    async def execute(
        self,
        input: EmailSyncInput,
        context: PipelineContext,
    ) -> ActionResult[EmailSyncOutput]:
        """Execute the email sync pipeline."""
        logger.info("Starting email sync pipeline")

        # Require user context
        if context.user_id is None:
            return ActionResult(
                success=False,
                error="User authentication required for email sync",
            )

        output = EmailSyncOutput()
        errors: list[str] = []

        async with get_db_context() as db:
            # Get email sources to sync
            if input.source_id:
                source = await email_source_repo.get_by_id(db, input.source_id)
                if source is None or source.user_id != context.user_id:
                    return ActionResult(
                        success=False,
                        error="Email source not found or access denied",
                    )
                sources = [source]
            else:
                sources = await email_source_repo.get_active_by_user_id(db, context.user_id)

            if not sources:
                return ActionResult(
                    success=True,
                    output=EmailSyncOutput(
                        errors=["No active email sources found. Connect your Gmail first."]
                    ),
                    metadata={"message": "No email sources to sync"},
                )

            # Process each source
            for source in sources:
                try:
                    result = await self._sync_source(
                        db,
                        source,
                        context.user_id,
                        force_full_sync=input.force_full_sync,
                    )
                    output.emails_processed += result["emails_processed"]
                    output.jobs_extracted += result["jobs_extracted"]
                    output.jobs_saved += result["jobs_saved"]
                    output.sources_synced += 1

                except Exception as e:
                    error_msg = f"Error syncing {source.email_address}: {e}"
                    logger.exception(error_msg)
                    errors.append(error_msg)

                    # Update source with error
                    await email_source_repo.update_sync_status(
                        db, source, datetime.now(UTC), error=str(e)
                    )

            await db.commit()

        output.errors = errors

        return ActionResult(
            success=len(errors) == 0,
            output=output,
            error="; ".join(errors) if errors else None,
            metadata={
                "sources_processed": len(sources),
                "total_jobs_saved": output.jobs_saved,
            },
        )

    async def _sync_source(
        self,
        db,
        source,
        user_id: UUID,
        force_full_sync: bool = False,
    ) -> dict:
        """Sync a single email source."""
        logger.info(f"Syncing email source: {source.email_address}")

        result = {
            "emails_processed": 0,
            "jobs_extracted": 0,
            "jobs_saved": 0,
        }

        # Initialize Gmail client
        gmail = GmailClient(
            access_token=source.access_token,
            refresh_token=source.refresh_token,
            token_expiry=source.token_expiry,
        )

        # Build query for job board senders
        all_senders = get_default_sender_domains()
        if source.custom_senders:
            all_senders.extend(source.custom_senders)

        # Determine date filter
        if force_full_sync or source.last_sync_at is None:
            # First sync or forced: look back configured hours
            after_timestamp = datetime.now(UTC) - timedelta(
                hours=settings.EMAIL_SYNC_LOOKBACK_HOURS
            )
        else:
            # Incremental sync: from last sync time
            after_timestamp = source.last_sync_at

        query = gmail.build_sender_query(all_senders, after_timestamp=after_timestamp)
        logger.info(f"Gmail query: {query}")

        # Fetch matching messages
        messages = await gmail.list_messages(query, max_results=100)
        logger.info(f"Found {len(messages)} matching emails")

        # Process each message
        for msg_info in messages:
            message_id = msg_info["id"]

            # Check if already processed
            existing = await email_source_repo.get_message_by_gmail_id(
                db, source.id, message_id
            )
            if existing:
                logger.debug(f"Skipping already processed message: {message_id}")
                continue

            try:
                # Fetch full message content
                email_content = await gmail.get_message(message_id)
                result["emails_processed"] += 1

                # Determine parser based on sender
                parser_name, source_name = get_parser_for_sender(email_content.from_address)
                parser = get_parser(parser_name)

                # Parse email
                extracted_jobs = await parser.parse(
                    subject=email_content.subject,
                    body_html=email_content.body_html,
                    body_text=email_content.body_text,
                )
                result["jobs_extracted"] += len(extracted_jobs)

                # Save jobs
                jobs_saved = 0
                for job in extracted_jobs:
                    # Check for duplicate
                    existing_job = await job_repo.get_by_url_and_user(
                        db, job.job_url, user_id
                    )
                    if existing_job:
                        continue

                    # Create new job
                    await job_repo.create(
                        db,
                        user_id=user_id,
                        title=job.title,
                        company=job.company,
                        location=job.location,
                        job_url=job.job_url,
                        salary_range=job.salary_range,
                        source=job.source or source_name.lower(),
                        description=job.description_snippet,
                    )
                    jobs_saved += 1

                result["jobs_saved"] += jobs_saved

                # Record processed message
                await email_source_repo.create_message(
                    db,
                    source_id=source.id,
                    gmail_message_id=message_id,
                    gmail_thread_id=email_content.thread_id,
                    subject=email_content.subject,
                    from_address=email_content.from_address,
                    received_at=email_content.received_at,
                    processed_at=datetime.now(UTC),
                    jobs_extracted=len(extracted_jobs),
                    parser_used=parser_name,
                )

                logger.info(
                    f"Processed email: {email_content.subject[:50]} - "
                    f"extracted {len(extracted_jobs)} jobs, saved {jobs_saved} new"
                )

            except Exception as e:
                logger.exception(f"Error processing message {message_id}: {e}")

                # Record failed message
                await email_source_repo.create_message(
                    db,
                    source_id=source.id,
                    gmail_message_id=message_id,
                    gmail_thread_id=msg_info.get("threadId"),
                    subject="(Error fetching subject)",
                    from_address="unknown",
                    received_at=datetime.now(UTC),
                    processed_at=datetime.now(UTC),
                    jobs_extracted=0,
                    processing_error=str(e),
                )

        # Update tokens if refreshed
        if gmail.tokens_refreshed and gmail.new_access_token:
            await email_source_repo.update_tokens(
                db, source, gmail.new_access_token, gmail.new_token_expiry
            )

        # Update sync status
        await email_source_repo.update_sync_status(db, source, datetime.now(UTC))

        logger.info(
            f"Sync complete for {source.email_address}: "
            f"{result['emails_processed']} emails, "
            f"{result['jobs_extracted']} extracted, "
            f"{result['jobs_saved']} saved"
        )

        return result

