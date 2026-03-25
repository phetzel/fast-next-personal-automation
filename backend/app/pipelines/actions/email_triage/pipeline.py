"""Email triage pipeline: classify inbox messages and route jobs/finance."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any, ClassVar
from uuid import UUID

from app.clients.gmail import EmailContent, GmailClient
from app.core.config import settings
from app.db.session import get_db_context
from app.email.utils import normalize_sender, sender_domain, should_archive_recommend
from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.actions.email_triage.classifier import classify_email
from app.pipelines.registry import register_pipeline
from app.repositories import email_action_log_repo, email_destination_repo, email_source_repo
from app.schemas.email_triage import EmailTriageRunInput, EmailTriageRunResult

logger = logging.getLogger(__name__)


@register_pipeline
class EmailTriagePipeline(ActionPipeline[EmailTriageRunInput, EmailTriageRunResult]):
    """Classify inbox emails into triage buckets and route jobs/finance messages."""

    name = "email_triage"
    description = "Classify recent Gmail messages and route jobs/finance into their domains"
    tags: ClassVar[list[str]] = ["email", "triage", "routing"]
    area: ClassVar[str | None] = "email"

    async def execute(
        self,
        input: EmailTriageRunInput,
        context: PipelineContext,
    ) -> ActionResult[EmailTriageRunResult]:
        if context.user_id is None:
            return ActionResult(
                success=False, error="User authentication required for email triage"
            )

        output = EmailTriageRunResult()
        errors: list[str] = []

        async with get_db_context() as db:
            if input.source_id:
                source = await email_source_repo.get_by_id(db, input.source_id)
                if source is None or source.user_id != context.user_id:
                    return ActionResult(
                        success=False, error="Email source not found or access denied"
                    )
                sources = [source]
            else:
                sources = await email_source_repo.get_active_by_user_id(db, context.user_id)

            if not sources:
                return ActionResult(
                    success=True,
                    output=EmailTriageRunResult(
                        errors=["No active email sources found. Connect your Gmail first."]
                    ),
                )

            for source in sources:
                try:
                    source_result = await self._triage_source(db, source, input, context.user_id)
                    output.messages_scanned += source_result["messages_scanned"]
                    output.messages_triaged += source_result["messages_triaged"]
                    output.sources_processed += 1
                    for bucket, count in source_result["bucket_counts"].items():
                        output.bucket_counts[bucket] = output.bucket_counts.get(bucket, 0) + count
                    output.routed_job_messages += source_result.get("routed_job_messages", 0)
                    output.created_jobs += source_result.get("created_jobs", 0)
                    output.routed_finance_messages += source_result.get(
                        "routed_finance_messages", 0
                    )
                    output.imported_transactions += source_result.get("imported_transactions", 0)
                    output.routing_errors += source_result.get("routing_errors", 0)
                    output.auto_archived += source_result.get("auto_archived", 0)
                    output.auto_labeled += source_result.get("auto_labeled", 0)
                    output.auto_marked_read += source_result.get("auto_marked_read", 0)
                    output.auto_action_errors += source_result.get("auto_action_errors", 0)
                    errors.extend(source_result["errors"])
                except Exception as exc:
                    logger.exception("Error triaging %s", source.email_address)
                    error_msg = f"Error triaging {source.email_address}: {exc}"
                    errors.append(error_msg)
                    await email_source_repo.update_triage_status(db, source, error=str(exc))

            await db.commit()

        output.errors = errors
        return ActionResult(
            success=len(errors) == 0,
            output=output,
            error="; ".join(errors) if errors else None,
            metadata={
                "sources_processed": output.sources_processed,
                "messages_triaged": output.messages_triaged,
            },
        )

    async def _triage_source(
        self, db, source, input: EmailTriageRunInput, user_id: UUID
    ) -> dict[str, object]:
        result: dict[str, object] = {
            "messages_scanned": 0,
            "messages_triaged": 0,
            "bucket_counts": {},
            "routed_job_messages": 0,
            "created_jobs": 0,
            "routed_finance_messages": 0,
            "imported_transactions": 0,
            "routing_errors": 0,
            "auto_archived": 0,
            "auto_labeled": 0,
            "auto_marked_read": 0,
            "auto_action_errors": 0,
            "errors": [],
        }

        access_token, refresh_token = email_source_repo.get_decrypted_tokens(source)
        gmail = GmailClient(
            access_token=access_token,
            refresh_token=refresh_token,
            token_expiry=source.token_expiry,
        )

        after_timestamp = self._get_after_timestamp(source, input)
        query = self._build_query(after_timestamp)
        messages = await gmail.list_messages(query, max_results=input.limit_per_source)
        result["messages_scanned"] = len(messages)

        now = datetime.now(UTC)
        source_errors: list[str] = []
        # Collect messages eligible for routing after classification
        routable: list[tuple[Any, EmailContent, str]] = []  # (message, email_content, bucket)

        for msg_info in messages:
            message_id = msg_info["id"]
            try:
                email_content = await gmail.get_message(message_id)

                message, _created = await email_source_repo.get_or_create_message(
                    db,
                    source_id=source.id,
                    gmail_message_id=email_content.message_id,
                    gmail_thread_id=email_content.thread_id,
                    subject=email_content.subject,
                    from_address=email_content.from_address,
                    to_address=email_content.to_address,
                    received_at=email_content.received_at,
                    processed_at=None,
                    sync_id=None,
                )

                if message.bucket and not input.force_full_run:
                    await email_source_repo.update_message_triage(
                        db,
                        message,
                        gmail_thread_id=email_content.thread_id,
                        subject=email_content.subject,
                        from_address=email_content.from_address,
                        to_address=email_content.to_address,
                        received_at=email_content.received_at,
                    )
                    continue

                classification = await classify_email(email_content)
                archive_recommended = should_archive_recommend(
                    classification.bucket,
                    classification.confidence,
                    classification.actionability_score,
                    classification.is_vip,
                )
                source_user_id = getattr(source, "user_id", None)
                (
                    bucket,
                    requires_review,
                    unsubscribe_candidate,
                    archive_recommended,
                ) = (
                    await self._apply_cleanup_rules(
                        db,
                        source_user_id,
                        email_content.from_address,
                        email_content.subject,
                        bucket=classification.bucket,
                        requires_review=classification.requires_review,
                        unsubscribe_candidate=classification.unsubscribe_candidate,
                        archive_recommended=archive_recommended,
                    )
                    if source_user_id is not None
                    else (
                        classification.bucket,
                        classification.requires_review,
                        classification.unsubscribe_candidate,
                        archive_recommended,
                    )
                )
                await email_source_repo.update_message_triage(
                    db,
                    message,
                    gmail_thread_id=email_content.thread_id,
                    subject=email_content.subject,
                    from_address=email_content.from_address,
                    to_address=email_content.to_address,
                    received_at=email_content.received_at,
                    bucket=bucket,
                    triage_status="classified",
                    triage_confidence=classification.confidence,
                    actionability_score=classification.actionability_score,
                    summary=classification.summary,
                    requires_review=requires_review,
                    unsubscribe_candidate=unsubscribe_candidate,
                    archive_recommended=archive_recommended,
                    is_vip=classification.is_vip,
                    triaged_at=now,
                )
                if source_user_id is not None:
                    await self._record_cleanup_suggestions(
                        db,
                        source_user_id,
                        message,
                        email_content.thread_id,
                        bucket=bucket,
                        unsubscribe_candidate=unsubscribe_candidate,
                        archive_recommended=archive_recommended,
                    )

                bucket_counts = result["bucket_counts"]
                assert isinstance(bucket_counts, dict)
                bucket_counts[bucket] = bucket_counts.get(bucket, 0) + 1
                result["messages_triaged"] = int(result["messages_triaged"]) + 1

                # Collect for routing
                if bucket in ("jobs", "finance"):
                    routable.append((message, email_content, bucket))

            except Exception as exc:
                logger.exception(
                    "Error triaging message %s for %s",
                    message_id,
                    source.email_address,
                )
                source_errors.append(
                    f"Error triaging message {message_id} for {source.email_address}: {exc}"
                )

        # Phase 3: route classified messages into Jobs and Finances
        if routable:
            routing_result = await self._route_classified_messages(
                db, user_id, routable, input.force_full_run
            )
            result["routed_job_messages"] = routing_result["routed_job_messages"]
            result["created_jobs"] = routing_result["created_jobs"]
            result["routed_finance_messages"] = routing_result["routed_finance_messages"]
            result["imported_transactions"] = routing_result["imported_transactions"]
            result["routing_errors"] = routing_result["routing_errors"]
            source_errors.extend(routing_result["errors"])

        # Phase 4: apply auto-actions for high-confidence messages
        if source.auto_actions_enabled:
            auto_result = await self._apply_auto_actions(db, user_id, source, gmail)
            result["auto_archived"] = auto_result["auto_archived"]
            result["auto_labeled"] = auto_result["auto_labeled"]
            result["auto_marked_read"] = auto_result["auto_marked_read"]
            result["auto_action_errors"] = auto_result["auto_action_errors"]
            source_errors.extend(auto_result["errors"])

        if gmail.tokens_refreshed and gmail.new_access_token:
            await email_source_repo.update_tokens(
                db,
                source,
                gmail.new_access_token,
                gmail.new_token_expiry,
            )

        if source_errors:
            result["errors"] = source_errors
            await email_source_repo.update_triage_status(
                db,
                source,
                error="; ".join(source_errors),
            )
        else:
            await email_source_repo.update_triage_status(
                db,
                source,
                last_triage_at=now,
                error=None,
            )
        return result

    def _build_query(self, after_timestamp: datetime) -> str:
        after_seconds = int(after_timestamp.timestamp())
        return f"after:{after_seconds} in:inbox -in:spam -in:trash -in:sent -in:drafts"

    def _get_after_timestamp(self, source, input: EmailTriageRunInput) -> datetime:
        if input.lookback_hours is not None:
            return datetime.now(UTC) - timedelta(hours=input.lookback_hours)

        if input.force_full_run or source.last_triage_at is None:
            return datetime.now(UTC) - timedelta(hours=settings.EMAIL_SYNC_LOOKBACK_HOURS)

        return source.last_triage_at - timedelta(hours=1)

    async def _route_classified_messages(
        self,
        db,
        user_id: UUID,
        routable: list[tuple[Any, EmailContent, str]],
        force_full_run: bool,
    ) -> dict[str, Any]:
        """Route jobs and finance messages into their domains after classification."""
        result: dict[str, Any] = {
            "routed_job_messages": 0,
            "created_jobs": 0,
            "routed_finance_messages": 0,
            "imported_transactions": 0,
            "routing_errors": 0,
            "errors": [],
        }

        from app.services.email import EmailService
        from app.services.finance_service import FinanceService
        from app.services.job import JobService
        from app.services.job_profile import JobProfileService

        email_service = EmailService(db)
        job_service = JobService(db)
        finance_service = FinanceService(db)
        profile_service = JobProfileService(db)

        # Ensure default destinations exist for audit trail
        jobs_destination = await email_service.ensure_default_destination(user_id)
        finance_destination = await email_service.ensure_default_finance_destination(user_id)

        # Load default job profile for scoring
        profile = await profile_service.get_default_for_user(user_id)
        resume_text = None
        target_roles = None
        min_score = 7.0
        if profile:
            resume_text = profile.resume.text_content if profile.resume else None
            target_roles = profile.target_roles
            min_score = profile.min_score_threshold or 7.0

        for message, email_content, bucket in routable:
            try:
                if bucket == "jobs":
                    routed = await self._route_job_message(
                        db,
                        user_id,
                        message,
                        email_content,
                        job_service,
                        email_service,
                        jobs_destination,
                        profile_id=profile.id if profile else None,
                        resume_text=resume_text,
                        target_roles=target_roles,
                        min_score=min_score,
                        force=force_full_run,
                    )
                    if routed is not None:
                        result["routed_job_messages"] += 1
                        result["created_jobs"] += routed

                elif bucket == "finance":
                    routed = await self._route_finance_message(
                        db,
                        user_id,
                        message,
                        email_content,
                        finance_service,
                        email_service,
                        finance_destination,
                        force=force_full_run,
                    )
                    if routed is not None:
                        result["routed_finance_messages"] += 1
                        result["imported_transactions"] += routed

            except Exception as exc:
                result["routing_errors"] += 1
                logger.exception("Error routing %s message %s", bucket, message.id)
                result["errors"].append(f"Error routing {bucket} message {message.id}: {exc}")
                # Mark for review on routing failure
                await email_source_repo.update_message_triage(db, message, requires_review=True)
                await email_action_log_repo.create(
                    db,
                    user_id=user_id,
                    message_id=message.id,
                    gmail_thread_id=message.gmail_thread_id,
                    action_type=f"route_{bucket}",
                    action_status="failed",
                    action_source="system",
                    reason=str(exc),
                )

        return result

    async def _route_job_message(
        self,
        db,
        user_id: UUID,
        message,
        email_content: EmailContent,
        job_service,
        email_service,
        destination,
        *,
        profile_id: UUID | None,
        resume_text: str | None,
        target_roles: list[str] | None,
        min_score: float,
        force: bool,
    ) -> int | None:
        """Route a single jobs-bucket message. Returns created job count or None if skipped."""
        # Idempotency: check if already routed to this destination
        existing = await email_destination_repo.get_message_destinations(db, message.id)
        for emd in existing:
            if emd.destination_id == destination.id and not force:
                return None

        # Use the existing email processing path
        processing_result = await email_service.process_email_for_destination(
            message=message,
            destination=destination,
            email_content={
                "subject": email_content.subject,
                "body_html": email_content.body_html,
                "body_text": email_content.body_text,
            },
            job_service=job_service,
            profile_id=profile_id,
            resume_text=resume_text,
            target_roles=target_roles,
            min_score=min_score,
        )

        # Set source_email_message_id on created jobs
        created_ids = processing_result.get("created_item_ids", [])
        if created_ids:
            from app.repositories import job_repo

            for job_id_str in created_ids:
                try:
                    from uuid import UUID as UUIDType

                    job = await job_repo.get_by_id(db, UUIDType(job_id_str))
                    if job and job.source_email_message_id is None:
                        job.source_email_message_id = message.id
                except Exception:
                    logger.warning("Could not set source_email_message_id on job %s", job_id_str)

        # Record destination processing
        await email_service.record_destination_processing(
            message_id=message.id,
            destination_id=destination.id,
            parser_used=processing_result.get("parser_used"),
            items_extracted=processing_result.get("items_extracted", 0),
            processing_error=processing_result.get("error"),
            created_item_ids=created_ids,
        )

        # Log the routing action
        jobs_saved = processing_result.get("jobs_saved", 0)
        await email_action_log_repo.create(
            db,
            user_id=user_id,
            message_id=message.id,
            gmail_thread_id=message.gmail_thread_id,
            action_type="route_jobs",
            action_status="applied",
            action_source="system",
            metadata={
                "items_extracted": processing_result.get("items_extracted", 0),
                "jobs_saved": jobs_saved,
                "created_item_ids": created_ids,
            },
        )

        if jobs_saved == 0 and processing_result.get("items_extracted", 0) == 0:
            await email_source_repo.update_message_triage(db, message, requires_review=True)

        return jobs_saved

    async def _route_finance_message(
        self,
        db,
        user_id: UUID,
        message,
        email_content: EmailContent,
        finance_service,
        email_service,
        destination,
        *,
        force: bool,
    ) -> int | None:
        """Route a single finance-bucket message. Returns imported tx count or None if skipped."""
        # Idempotency: check if already routed to this destination
        existing = await email_destination_repo.get_message_destinations(db, message.id)
        for emd in existing:
            if emd.destination_id == destination.id and not force:
                return None

        from app.pipelines.actions.finance_email_sync.parser import parse_transaction_email

        parsed = await parse_transaction_email(
            subject=email_content.subject,
            body_text=email_content.body_text or "",
            body_html=email_content.body_html or "",
            openai_api_key=settings.OPENAI_API_KEY,
        )

        imported_count = 0
        created_item_ids: list[str] = []

        if parsed:
            # Attach raw_email_id for dedup and source_email_message_id for traceability
            for tx in parsed:
                tx["raw_email_id"] = email_content.message_id
                tx["source_email_message_id"] = message.id

            imported_count, _skipped, created_txns = await finance_service.ingest_from_email(
                user_id, parsed
            )
            created_item_ids = [str(tx.id) for tx in created_txns]

        # Record destination processing
        await email_service.record_destination_processing(
            message_id=message.id,
            destination_id=destination.id,
            parser_used="finance_ai",
            items_extracted=len(parsed) if parsed else 0,
            processing_error=None,
            created_item_ids=created_item_ids,
        )

        # Log the routing action
        await email_action_log_repo.create(
            db,
            user_id=user_id,
            message_id=message.id,
            gmail_thread_id=message.gmail_thread_id,
            action_type="route_finance",
            action_status="applied",
            action_source="system",
            metadata={
                "transactions_found": len(parsed) if parsed else 0,
                "transactions_imported": imported_count,
            },
        )

        if imported_count == 0 and (not parsed or len(parsed) == 0):
            await email_source_repo.update_message_triage(db, message, requires_review=True)

        return imported_count

    async def _apply_auto_actions(
        self,
        db,
        user_id: UUID,
        source,
        gmail: GmailClient,
    ) -> dict[str, Any]:
        """Apply auto-actions for high-confidence, non-VIP messages in this run."""
        from app.services.email import AUTOMATION_LABELS

        result: dict[str, Any] = {
            "auto_archived": 0,
            "auto_labeled": 0,
            "auto_marked_read": 0,
            "auto_action_errors": 0,
            "errors": [],
        }

        threshold = source.auto_action_confidence_threshold

        # Find messages that were classified in this session and qualify for auto-action
        eligible = await email_source_repo.list_auto_actionable_messages(
            db,
            source_id=source.id,
            confidence_threshold=threshold,
        )

        for message in eligible:
            bucket = message.bucket
            try:
                if bucket == "notifications":
                    # Notifications: mark read only, don't archive
                    previous_labels = await gmail.modify_message(
                        message.gmail_message_id, remove_label_ids=["UNREAD"]
                    )
                    result["auto_marked_read"] += 1
                    await email_action_log_repo.create(
                        db,
                        user_id=user_id,
                        message_id=message.id,
                        gmail_thread_id=message.gmail_thread_id,
                        action_type="mark_read",
                        action_status="applied",
                        action_source="system",
                        metadata={
                            "auto_action": True,
                            "confidence": message.triage_confidence,
                            "previous_labels": previous_labels,
                            "removed_labels": ["UNREAD"],
                        },
                    )
                elif bucket in AUTOMATION_LABELS:
                    # Jobs, finance, newsletter, done: label + archive + mark read
                    label_name = AUTOMATION_LABELS[bucket]
                    label_id = await gmail.get_or_create_label(label_name)
                    previous_labels = await gmail.modify_message(
                        message.gmail_message_id,
                        add_label_ids=[label_id],
                        remove_label_ids=["INBOX", "UNREAD"],
                    )
                    result["auto_archived"] += 1
                    result["auto_labeled"] += 1
                    result["auto_marked_read"] += 1
                    await email_action_log_repo.create(
                        db,
                        user_id=user_id,
                        message_id=message.id,
                        gmail_thread_id=message.gmail_thread_id,
                        action_type="archive",
                        action_status="applied",
                        action_source="system",
                        metadata={
                            "auto_action": True,
                            "confidence": message.triage_confidence,
                            "previous_labels": previous_labels,
                            "applied_labels": [label_name],
                            "removed_labels": ["INBOX", "UNREAD"],
                        },
                    )
                else:
                    continue

                await email_source_repo.update_message_triage(
                    db,
                    message,
                    triage_status="actioned",
                    last_action_at=datetime.now(UTC),
                )
            except Exception as exc:
                result["auto_action_errors"] += 1
                logger.exception("Auto-action failed for message %s (%s)", message.id, bucket)
                result["errors"].append(f"Auto-action error for message {message.id}: {exc}")

        return result

    async def _apply_cleanup_rules(
        self,
        db,
        user_id,
        from_address: str,
        subject: str | None,
        *,
        bucket: str,
        requires_review: bool,
        unsubscribe_candidate: bool,
        archive_recommended: bool,
    ) -> tuple[str, bool, bool, bool]:
        """Apply matching cleanup rules after base classification."""
        rules = await email_destination_repo.find_matching_destinations(
            db,
            user_id,
            from_address,
            subject,
            destination_type="cleanup",
        )
        if not rules:
            return bucket, requires_review, unsubscribe_candidate, archive_recommended

        rule = rules[0]
        if rule.bucket_override:
            bucket = rule.bucket_override
            requires_review = bucket == "review"
            if bucket != "newsletter":
                unsubscribe_candidate = False

        if rule.always_keep:
            return bucket, False, False, False

        unsubscribe_candidate = unsubscribe_candidate or rule.queue_unsubscribe
        archive_recommended = archive_recommended or rule.suggest_archive
        return bucket, requires_review, unsubscribe_candidate, archive_recommended

    async def _record_cleanup_suggestions(
        self,
        db,
        user_id,
        message,
        gmail_thread_id: str | None,
        *,
        bucket: str,
        unsubscribe_candidate: bool,
        archive_recommended: bool,
    ) -> None:
        """Record suggestion logs for cleanup-related triage output."""
        normalized = normalize_sender(message.from_address)
        domain = sender_domain(message.from_address)
        if unsubscribe_candidate:
            await self._record_cleanup_suggestion(
                db,
                user_id,
                message.id,
                gmail_thread_id,
                normalized,
                domain,
                action_type="unsubscribe_candidate",
                metadata={"bucket": bucket},
            )
        if archive_recommended:
            await self._record_cleanup_suggestion(
                db,
                user_id,
                message.id,
                gmail_thread_id,
                normalized,
                domain,
                action_type="archive_recommendation",
                metadata={"bucket": bucket},
            )

    async def _record_cleanup_suggestion(
        self,
        db,
        user_id,
        message_id,
        gmail_thread_id: str | None,
        normalized_sender: str | None,
        sender_domain_value: str | None,
        *,
        action_type: str,
        metadata: dict[str, str],
    ) -> None:
        """Write a single cleanup suggestion if one does not already exist."""
        existing = await email_action_log_repo.get_by_message_action(
            db,
            user_id=user_id,
            message_id=message_id,
            action_type=action_type,
            action_status="suggested",
            action_source="system",
        )
        if existing is not None:
            return

        await email_action_log_repo.create(
            db,
            user_id=user_id,
            message_id=message_id,
            gmail_thread_id=gmail_thread_id,
            normalized_sender=normalized_sender,
            sender_domain=sender_domain_value,
            action_type=action_type,
            action_status="suggested",
            action_source="system",
            metadata=metadata,
        )
