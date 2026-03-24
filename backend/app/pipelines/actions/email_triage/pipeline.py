"""Read-only email triage pipeline for bucketing inbox messages."""

import logging
from datetime import UTC, datetime, timedelta
from typing import ClassVar

from app.clients.gmail import GmailClient
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
    """Classify inbox emails into Phase 1 triage buckets without mutating Gmail."""

    name = "email_triage"
    description = "Classify recent Gmail messages into triage buckets"
    tags: ClassVar[list[str]] = ["email", "triage", "read-only"]
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
                    source_result = await self._triage_source(db, source, input)
                    output.messages_scanned += source_result["messages_scanned"]
                    output.messages_triaged += source_result["messages_triaged"]
                    output.sources_processed += 1
                    for bucket, count in source_result["bucket_counts"].items():
                        output.bucket_counts[bucket] = output.bucket_counts.get(bucket, 0) + count
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

    async def _triage_source(self, db, source, input: EmailTriageRunInput) -> dict[str, object]:
        result: dict[str, object] = {
            "messages_scanned": 0,
            "messages_triaged": 0,
            "bucket_counts": {},
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
            except Exception as exc:
                logger.exception(
                    "Error triaging message %s for %s",
                    message_id,
                    source.email_address,
                )
                source_errors.append(
                    f"Error triaging message {message_id} for {source.email_address}: {exc}"
                )

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
