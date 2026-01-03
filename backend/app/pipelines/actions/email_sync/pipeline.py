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
from app.repositories import email_source_repo, email_sync_repo, job_profile_repo
from app.services.job import JobService, RawJob

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
    enrich_descriptions: bool = Field(
        default=True,
        description="If true, scrape full job descriptions from URLs before AI analysis.",
    )
    save_all: bool = Field(
        default=False,
        description="If true, save all jobs regardless of score. If false, only save jobs meeting min_score threshold.",
    )


class EmailSyncOutput(BaseModel):
    """Output from email sync pipeline."""

    emails_processed: int = Field(default=0, description="Number of emails processed")
    jobs_extracted: int = Field(default=0, description="Total jobs extracted from emails")
    jobs_enriched: int = Field(default=0, description="Jobs with descriptions scraped from URL")
    jobs_analyzed: int = Field(default=0, description="Jobs analyzed with AI scoring")
    jobs_saved: int = Field(default=0, description="New jobs saved (after deduplication)")
    jobs_filtered: int = Field(default=0, description="Jobs filtered out due to low score")
    high_scoring: int = Field(default=0, description="Jobs with score >= min threshold")
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
        sync = None

        async with get_db_context() as db:
            # Create EmailSync record
            sync = await email_sync_repo.create(
                db,
                user_id=context.user_id,
                started_at=datetime.now(UTC),
                status="running",
            )

            # Get email sources to sync
            if input.source_id:
                source = await email_source_repo.get_by_id(db, input.source_id)
                if source is None or source.user_id != context.user_id:
                    await email_sync_repo.complete(
                        db, sync, 0, 0, 0, error_message="Email source not found or access denied"
                    )
                    await db.commit()
                    return ActionResult(
                        success=False,
                        error="Email source not found or access denied",
                    )
                sources = [source]
            else:
                sources = await email_source_repo.get_active_by_user_id(db, context.user_id)

            if not sources:
                await email_sync_repo.complete(
                    db, sync, 0, 0, 0, error_message="No active email sources found"
                )
                await db.commit()
                return ActionResult(
                    success=True,
                    output=EmailSyncOutput(
                        errors=["No active email sources found. Connect your Gmail first."]
                    ),
                    metadata={"message": "No email sources to sync"},
                )

            total_emails_fetched = 0

            # Process each source
            for source in sources:
                try:
                    result = await self._sync_source(
                        db,
                        source,
                        context.user_id,
                        sync_id=sync.id,
                        force_full_sync=input.force_full_sync,
                        enrich_descriptions=input.enrich_descriptions,
                        save_all=input.save_all,
                    )
                    output.emails_processed += result["emails_processed"]
                    output.jobs_extracted += result["jobs_extracted"]
                    output.jobs_enriched += result.get("jobs_enriched", 0)
                    output.jobs_analyzed += result["jobs_analyzed"]
                    output.jobs_saved += result["jobs_saved"]
                    output.jobs_filtered += result.get("jobs_filtered", 0)
                    output.high_scoring += result["high_scoring"]
                    output.sources_synced += 1
                    total_emails_fetched += result.get("emails_fetched", result["emails_processed"])

                except Exception as e:
                    error_msg = f"Error syncing {source.email_address}: {e}"
                    logger.exception(error_msg)
                    errors.append(error_msg)

                    # Update source with error
                    await email_source_repo.update_sync_status(
                        db, source, datetime.now(UTC), error=str(e)
                    )

            # Complete the sync record
            await email_sync_repo.complete(
                db,
                sync,
                sources_synced=output.sources_synced,
                emails_fetched=total_emails_fetched,
                emails_processed=output.emails_processed,
                sync_metadata={
                    "jobs_extracted": output.jobs_extracted,
                    "jobs_enriched": output.jobs_enriched,
                    "jobs_analyzed": output.jobs_analyzed,
                    "jobs_saved": output.jobs_saved,
                    "jobs_filtered": output.jobs_filtered,
                    "high_scoring": output.high_scoring,
                },
                error_message="; ".join(errors) if errors else None,
            )

            await db.commit()

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

    async def _sync_source(
        self,
        db,
        source,
        user_id: UUID,
        sync_id: UUID | None = None,
        force_full_sync: bool = False,
        enrich_descriptions: bool = True,
        save_all: bool = False,
    ) -> dict:
        """Sync a single email source.

        Args:
            db: Database session
            source: EmailSource to sync
            user_id: User ID
            sync_id: Optional sync record ID
            force_full_sync: If true, ignore last_sync_at
            enrich_descriptions: If true, scrape full job descriptions from URLs
            save_all: If true, save all jobs regardless of score
        """
        logger.info(f"Syncing email source: {source.email_address}")

        result = {
            "emails_processed": 0,
            "emails_fetched": 0,
            "jobs_extracted": 0,
            "jobs_enriched": 0,
            "jobs_analyzed": 0,
            "jobs_saved": 0,
            "jobs_filtered": 0,
            "high_scoring": 0,
        }

        # Get user's default profile for AI analysis
        profile = await job_profile_repo.get_default_for_user(db, user_id)
        resume_text = None
        target_roles = None
        min_score = 7.0

        if profile and profile.resume and profile.resume.text_content:
            resume_text = profile.resume.text_content
            target_roles = profile.target_roles
            min_score = profile.min_score_threshold or 7.0
            logger.info(f"AI scoring enabled with profile '{profile.name}'")
        else:
            logger.info("No profile with resume found - jobs will not be AI scored")

        # Initialize job service
        job_service = JobService(db)

        # Initialize Gmail client with decrypted tokens
        access_token, refresh_token = email_source_repo.get_decrypted_tokens(source)
        gmail = GmailClient(
            access_token=access_token,
            refresh_token=refresh_token,
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
        result["emails_fetched"] = len(messages)

        # Process each message
        for msg_info in messages:
            message_id = msg_info["id"]

            # Check if already processed
            existing = await email_source_repo.get_message_by_gmail_id(db, source.id, message_id)
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

                # Convert to RawJob format
                raw_jobs = [
                    RawJob.from_extracted(job, source_override=source_name.lower())
                    for job in extracted_jobs
                ]

                # Enrich jobs with full descriptions from URLs
                if raw_jobs and enrich_descriptions:
                    raw_jobs = await self._enrich_job_descriptions(raw_jobs)
                    result["jobs_enriched"] += sum(
                        1 for job in raw_jobs if job.description and len(job.description) > 200
                    )

                if raw_jobs:
                    ingestion = await job_service.ingest_jobs(
                        user_id=user_id,
                        jobs=raw_jobs,
                        ingestion_source="email",
                        profile_id=profile.id if profile else None,
                        resume_text=resume_text,
                        target_roles=target_roles,
                        min_score=min_score,
                        save_all=save_all,  # Respect save_all setting
                    )
                    result["jobs_analyzed"] += ingestion.jobs_analyzed
                    result["jobs_saved"] += ingestion.jobs_saved
                    result["jobs_filtered"] += (
                        ingestion.jobs_received
                        - ingestion.jobs_saved
                        - ingestion.duplicates_skipped
                    )
                    result["high_scoring"] += ingestion.high_scoring

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
                    sync_id=sync_id,
                    jobs_extracted=len(extracted_jobs),
                    parser_used=parser_name,
                )

                logger.info(
                    f"Processed email: {email_content.subject[:50]} - "
                    f"extracted {len(extracted_jobs)} jobs"
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
                    sync_id=sync_id,
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
            f"{result['jobs_enriched']} enriched, "
            f"{result['jobs_analyzed']} analyzed, "
            f"{result['jobs_saved']} saved, "
            f"{result['jobs_filtered']} filtered, "
            f"{result['high_scoring']} high scoring"
        )

        return result

    async def _enrich_job_descriptions(
        self,
        raw_jobs: list[RawJob],
        max_concurrent: int = 3,
    ) -> list[RawJob]:
        """Enrich jobs with full descriptions scraped from their URLs.

        Jobs that already have substantial descriptions (> 500 chars) are skipped.
        Jobs where scraping fails retain their original description_snippet.

        Args:
            raw_jobs: List of RawJob objects to enrich
            max_concurrent: Max concurrent scraping tasks

        Returns:
            List of RawJob objects with enriched descriptions
        """
        from app.browser.job_scraper import scrape_job_descriptions_batch

        # Collect URLs that need scraping
        urls_to_scrape: list[str] = []
        url_to_job_indices: dict[str, list[int]] = {}

        for i, job in enumerate(raw_jobs):
            # Skip if already has a substantial description
            if job.description and len(job.description) > 500:
                continue

            url = job.job_url
            if url not in url_to_job_indices:
                url_to_job_indices[url] = []
                urls_to_scrape.append(url)
            url_to_job_indices[url].append(i)

        if not urls_to_scrape:
            logger.info("No jobs need description enrichment")
            return raw_jobs

        logger.info(f"Enriching descriptions for {len(urls_to_scrape)} jobs")

        # Scrape descriptions
        scraped = await scrape_job_descriptions_batch(
            urls_to_scrape,
            max_concurrent=max_concurrent,
        )

        # Update jobs with scraped descriptions
        enriched_count = 0
        for url, result in scraped.items():
            if result.success and result.description:
                for job_idx in url_to_job_indices.get(url, []):
                    raw_jobs[job_idx].description = result.description
                    enriched_count += 1

        logger.info(f"Successfully enriched {enriched_count} job descriptions")
        return raw_jobs
