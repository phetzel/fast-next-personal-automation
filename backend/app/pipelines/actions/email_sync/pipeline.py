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
from app.email.config import get_default_sender_domains
from app.email.utils import sender_matches_pattern
from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.registry import register_pipeline
from app.repositories import email_destination_repo, email_source_repo, email_sync_repo
from app.services.email import EmailService
from app.services.job import JobService

logger = logging.getLogger(__name__)


class EmailSyncInput(BaseModel):
    """Input for email sync pipeline."""

    source_id: UUID | None = Field(
        default=None,
        description="Specific email source to sync. If not provided, syncs all active sources.",
    )
    sync_id: UUID | None = Field(
        default=None,
        description="Existing EmailSync row to update. Used by manual API triggers.",
    )
    force_full_sync: bool = Field(
        default=False,
        description="If true, ignores last_sync_at and syncs all matching emails.",
    )
    save_all: bool = Field(
        default=False,
        description="If true, save all jobs regardless of score. If false, only save jobs meeting min_score threshold.",
    )


class EmailSyncOutput(BaseModel):
    """Output from email sync pipeline."""

    emails_processed: int = Field(default=0, description="Number of emails processed")
    jobs_extracted: int = Field(default=0, description="Total jobs extracted from emails")
    jobs_analyzed: int = Field(default=0, description="Jobs analyzed with AI scoring")
    jobs_saved: int = Field(default=0, description="New jobs saved (after deduplication)")
    jobs_filtered: int = Field(default=0, description="Jobs filtered out due to low score")
    high_scoring: int = Field(default=0, description="Jobs with score >= min threshold")
    sources_synced: int = Field(default=0, description="Number of email sources synced")
    errors: list[str] = Field(default_factory=list, description="Any errors encountered")


@register_pipeline
class EmailSyncJobsPipeline(ActionPipeline[EmailSyncInput, EmailSyncOutput]):
    """Email sync pipeline that fetches and parses job alert emails."""

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

        if context.user_id is None:
            return ActionResult(
                success=False,
                error="User authentication required for email sync",
            )

        output = EmailSyncOutput()
        errors: list[str] = []
        sources = []
        sync = None

        async with get_db_context() as db:
            email_service = EmailService(db)

            if input.sync_id:
                sync = await email_sync_repo.get_by_id(db, input.sync_id)
                if sync is None or sync.user_id != context.user_id:
                    return ActionResult(
                        success=False,
                        error="Email sync not found or access denied",
                    )
            else:
                sync, is_new = await email_service.start_sync(
                    context.user_id,
                    input.force_full_sync,
                )
                if not is_new:
                    return ActionResult(
                        success=True,
                        output=EmailSyncOutput(
                            errors=["Another email sync is already running."],
                        ),
                        metadata={
                            "sync_id": str(sync.id),
                            "status": "already_running",
                        },
                    )

            if input.source_id:
                source = await email_source_repo.get_by_id(db, input.source_id)
                if source is None or source.user_id != context.user_id:
                    await email_sync_repo.complete(
                        db,
                        sync,
                        0,
                        0,
                        0,
                        error_message="Email source not found or access denied",
                    )
                    return ActionResult(
                        success=False,
                        error="Email source not found or access denied",
                    )
                sources = [source]
            else:
                sources = await email_source_repo.get_active_by_user_id(db, context.user_id)

            if not sources:
                await email_sync_repo.complete(
                    db,
                    sync,
                    0,
                    0,
                    0,
                    error_message="No active email sources found",
                )
                return ActionResult(
                    success=True,
                    output=EmailSyncOutput(
                        errors=["No active email sources found. Connect your Gmail first."]
                    ),
                    metadata={
                        "message": "No email sources to sync",
                        "sync_id": str(sync.id),
                    },
                )

            total_emails_fetched = 0

            for source in sources:
                try:
                    source_result = await self._sync_source(
                        db,
                        source,
                        context.user_id,
                        email_service=email_service,
                        sync_id=sync.id,
                        force_full_sync=input.force_full_sync,
                        save_all=input.save_all,
                    )
                    output.emails_processed += source_result["emails_processed"]
                    output.jobs_extracted += source_result["jobs_extracted"]
                    output.jobs_analyzed += source_result["jobs_analyzed"]
                    output.jobs_saved += source_result["jobs_saved"]
                    output.jobs_filtered += source_result["jobs_filtered"]
                    output.high_scoring += source_result["high_scoring"]
                    output.sources_synced += 1
                    total_emails_fetched += source_result["emails_fetched"]
                except Exception as exc:
                    error_msg = f"Error syncing {source.email_address}: {exc}"
                    logger.exception(error_msg)
                    errors.append(error_msg)
                    await email_source_repo.update_sync_status(
                        db,
                        source,
                        datetime.now(UTC),
                        error=str(exc),
                    )

            await email_sync_repo.complete(
                db,
                sync,
                sources_synced=output.sources_synced,
                emails_fetched=total_emails_fetched,
                emails_processed=output.emails_processed,
                sync_metadata={
                    "jobs_extracted": output.jobs_extracted,
                    "jobs_analyzed": output.jobs_analyzed,
                    "jobs_saved": output.jobs_saved,
                    "jobs_filtered": output.jobs_filtered,
                    "high_scoring": output.high_scoring,
                },
                error_message="; ".join(errors) if errors else None,
            )

        output.errors = errors

        return ActionResult(
            success=len(errors) == 0,
            output=output,
            error="; ".join(errors) if errors else None,
            metadata={
                "sync_id": str(sync.id) if sync else None,
                "sources_processed": len(sources),
                "total_jobs_saved": output.jobs_saved,
            },
        )

    def _build_query_senders(
        self,
        active_destinations: list,
        custom_senders: list[str] | None,
    ) -> list[str]:
        """Collect sender patterns that should be queried from Gmail."""
        senders: list[str] = []

        for destination in active_destinations:
            rules = destination.filter_rules or {}
            sender_patterns = rules.get("sender_patterns", [])
            senders.extend(pattern for pattern in sender_patterns if pattern)

        if custom_senders:
            senders.extend(pattern for pattern in custom_senders if pattern)

        if not senders:
            senders.extend(get_default_sender_domains())

        deduped: list[str] = []
        seen: set[str] = set()
        for sender in senders:
            normalized = sender.strip().lower()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            deduped.append(normalized)

        return deduped

    def _matches_sender_patterns(self, from_address: str, patterns: list[str] | None) -> bool:
        """Check whether a sender address matches any configured email/domain pattern."""
        if not patterns:
            return False

        return any(sender_matches_pattern(from_address, pattern) for pattern in patterns)

    async def _sync_source(
        self,
        db,
        source,
        user_id: UUID,
        *,
        email_service: EmailService,
        sync_id: UUID | None = None,
        force_full_sync: bool = False,
        save_all: bool = False,
    ) -> dict:
        """Sync a single email source."""
        logger.info("Syncing email source: %s", source.email_address)

        result = {
            "emails_processed": 0,
            "emails_fetched": 0,
            "jobs_extracted": 0,
            "jobs_analyzed": 0,
            "jobs_saved": 0,
            "jobs_filtered": 0,
            "high_scoring": 0,
        }

        default_destination = await email_service.ensure_default_destination(user_id)
        active_destinations = await email_destination_repo.get_active_by_user_id(
            db,
            user_id,
            destination_type="jobs",
        )
        if not active_destinations:
            logger.info("Skipping email sync because no active destinations are configured")
            await email_source_repo.update_sync_status(db, source, datetime.now(UTC))
            return result

        job_service = JobService(db)
        profile = await job_service.require_scorable_profile(
            user_id,
            purpose="email job ingestion",
        )
        resume_text = profile.resume.text_content if profile.resume else None
        target_roles = profile.target_roles
        min_score = profile.min_score_threshold or 7.0
        logger.info("AI scoring enabled with profile '%s'", profile.name)

        access_token, refresh_token = email_source_repo.get_decrypted_tokens(source)
        gmail = GmailClient(
            access_token=access_token,
            refresh_token=refresh_token,
            token_expiry=source.token_expiry,
        )

        all_senders = self._build_query_senders(active_destinations, source.custom_senders)

        if force_full_sync or source.last_sync_at is None:
            after_timestamp = datetime.now(UTC) - timedelta(
                hours=settings.EMAIL_SYNC_LOOKBACK_HOURS
            )
        else:
            after_timestamp = source.last_sync_at

        query = gmail.build_sender_query(all_senders, after_timestamp=after_timestamp)
        logger.info("Gmail query: %s", query)

        messages = await gmail.list_messages(query, max_results=100)
        logger.info("Found %d matching emails", len(messages))
        result["emails_fetched"] = len(messages)

        for msg_info in messages:
            message_id = msg_info["id"]
            existing = await email_source_repo.get_message_by_gmail_id(db, source.id, message_id)
            if existing:
                logger.debug("Skipping already processed message: %s", message_id)
                continue

            claimed_message = None

            try:
                email_content = await gmail.get_message(message_id)

                matching_destinations = [
                    destination
                    for destination in active_destinations
                    if email_destination_repo.matches_email(
                        destination,
                        email_content.from_address,
                        email_content.subject,
                    )
                ]

                if (
                    not matching_destinations
                    and default_destination.is_active
                    and self._matches_sender_patterns(
                        email_content.from_address,
                        source.custom_senders,
                    )
                ):
                    matching_destinations = [default_destination]

                if not matching_destinations:
                    logger.debug(
                        "Skipping email with no matching destinations: %s",
                        email_content.subject,
                    )
                    continue

                claimed_message, created = await email_source_repo.get_or_create_message(
                    db,
                    source_id=source.id,
                    gmail_message_id=message_id,
                    gmail_thread_id=email_content.thread_id,
                    subject=email_content.subject,
                    from_address=email_content.from_address,
                    received_at=email_content.received_at,
                    processed_at=datetime.now(UTC),
                    sync_id=sync_id,
                )
                if not created:
                    logger.debug("Skipping concurrently claimed message: %s", message_id)
                    continue

                result["emails_processed"] += 1
                message_jobs_extracted = 0
                message_parser_used: str | None = None
                destination_errors: list[str] = []

                email_payload = {
                    "subject": email_content.subject,
                    "body_html": email_content.body_html,
                    "body_text": email_content.body_text,
                }

                for destination in matching_destinations:
                    destination_result = await email_service.process_email_for_destination(
                        claimed_message,
                        destination,
                        email_payload,
                        job_service,
                        profile_id=profile.id,
                        resume_text=resume_text,
                        target_roles=target_roles,
                        min_score=min_score,
                    )
                    await email_service.record_destination_processing(
                        claimed_message.id,
                        destination.id,
                        parser_used=destination_result["parser_used"],
                        items_extracted=destination_result["items_extracted"],
                        processing_error=destination_result["error"],
                        created_item_ids=destination_result["created_item_ids"],
                    )

                    message_jobs_extracted += destination_result["items_extracted"]
                    result["jobs_extracted"] += destination_result["items_extracted"]
                    result["jobs_analyzed"] += destination_result["jobs_analyzed"]
                    result["jobs_saved"] += destination_result["jobs_saved"]
                    result["jobs_filtered"] += destination_result["jobs_filtered"]
                    result["high_scoring"] += destination_result["high_scoring"]

                    if message_parser_used is None and destination_result["parser_used"]:
                        message_parser_used = destination_result["parser_used"]
                    if destination_result["error"]:
                        destination_errors.append(
                            f"{destination.name}: {destination_result['error']}"
                        )

                await email_source_repo.update_message_processing(
                    db,
                    claimed_message,
                    processed_at=datetime.now(UTC),
                    jobs_extracted=message_jobs_extracted,
                    parser_used=message_parser_used,
                    processing_error="; ".join(destination_errors) if destination_errors else None,
                )

                logger.info(
                    "Processed email '%s' into %d destination(s); extracted %d item(s)",
                    email_content.subject[:50],
                    len(matching_destinations),
                    message_jobs_extracted,
                )

            except Exception as exc:
                logger.exception("Error processing message %s: %s", message_id, exc)

                if claimed_message is not None:
                    await email_source_repo.update_message_processing(
                        db,
                        claimed_message,
                        processed_at=datetime.now(UTC),
                        jobs_extracted=0,
                        parser_used=None,
                        processing_error=str(exc),
                    )
                    continue

                await email_source_repo.get_or_create_message(
                    db,
                    source_id=source.id,
                    gmail_message_id=message_id,
                    gmail_thread_id=msg_info.get("threadId"),
                    subject="(Error fetching subject)",
                    from_address="unknown",
                    received_at=datetime.now(UTC),
                    processed_at=datetime.now(UTC),
                    sync_id=sync_id,
                    processing_error=str(exc),
                )

        if gmail.tokens_refreshed and gmail.new_access_token:
            await email_source_repo.update_tokens(
                db,
                source,
                gmail.new_access_token,
                gmail.new_token_expiry,
            )

        await email_source_repo.update_sync_status(db, source, datetime.now(UTC))

        logger.info(
            "Sync complete for %s: %d emails, %d extracted, %d analyzed, %d saved, %d filtered, %d high scoring",
            source.email_address,
            result["emails_processed"],
            result["jobs_extracted"],
            result["jobs_analyzed"],
            result["jobs_saved"],
            result["jobs_filtered"],
            result["high_scoring"],
        )

        return result
