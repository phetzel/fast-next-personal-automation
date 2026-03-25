"""Email service.

Contains business logic for email operations including syncs, destinations, and routing.
"""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.gmail import GmailClient
from app.core.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.db.models.email_action_log import EmailActionLog
from app.db.models.email_destination import EmailDestination
from app.db.models.email_message import EmailMessage
from app.db.models.email_sync import EmailSync
from app.email.config import get_parser, get_parser_for_sender
from app.email.utils import (
    normalize_sender,
    sender_domain,
    sender_matches_pattern,
    should_archive_recommend,
)
from app.repositories import (
    email_action_log_repo,
    email_destination_repo,
    email_source_repo,
    email_sync_repo,
    scheduled_task_repo,
)
from app.schemas.scheduled_task import ScheduledTaskCreate
from app.services.job import JobService, RawJob
from app.services.scheduled_task import ScheduledTaskService

# Gmail label names managed by the app
AUTOMATION_LABELS = {
    "jobs": "Automations/Jobs",
    "finance": "Automations/Finance",
    "newsletter": "Automations/Newsletters",
    "done": "Automations/Done",
}

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
# Default financial senders for the finance destination
DEFAULT_FINANCE_SENDERS = [
    "chase.com",
    "bankofamerica.com",
    "paypal.com",
    "venmo.com",
    "apple.com",
    "netflix.com",
    "discover.com",
    "citibank.com",
    "wellsfargo.com",
    "stripe.com",
    "billing@",
    "receipt@",
    "invoice@",
    "statement@",
    "alerts@",
]
DEFAULT_CLEANUP_PRIORITY = 100
CLEANUP_GROUP_BATCH_SIZE = 500


def _build_default_sync_cron(interval_minutes: int) -> str:
    """Build a safe cron expression for the default email sync cadence."""
    if interval_minutes <= 0:
        return "0 * * * *"

    if interval_minutes < 60 and 60 % interval_minutes == 0:
        return f"*/{interval_minutes} * * * *"

    if interval_minutes % 60 == 0:
        hours = interval_minutes // 60
        if hours == 1:
            return "0 * * * *"
        if hours > 1 and 24 % hours == 0:
            return f"0 */{hours} * * *"

    logger.warning(
        "Unsupported email sync interval for cron; falling back to hourly",
        extra={"interval_minutes": interval_minutes},
    )
    return "0 * * * *"


def _cleanup_rule_name(pattern: str) -> str:
    """Consistent name for sender-domain cleanup rules."""
    return f"Cleanup: {pattern}"


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

    async def start_sync(
        self, user_id: UUID, force_full_sync: bool = False
    ) -> tuple[EmailSync, bool]:
        """Start a new email sync operation.

        Returns tuple of (sync record, is_new).
        - is_new=True means a new sync was created and pipeline should run
        - is_new=False means an existing sync was found (already running)
        """
        # First, cancel any syncs that have been running too long (10 min timeout)
        await email_sync_repo.cancel_stale_syncs(self.db, user_id, stale_minutes=10)

        # Check if there's already a running sync
        existing = await email_sync_repo.get_running_by_user(self.db, user_id)
        if existing:
            return existing, False

        # Create new sync record
        sync = await email_sync_repo.create(
            self.db,
            user_id=user_id,
            started_at=datetime.now(UTC),
            status="running",
        )

        return sync, True

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

    async def list_destinations(
        self,
        user_id: UUID,
        *,
        destination_type: str | None = None,
    ) -> list[EmailDestination]:
        """List email destinations for a user."""
        return await email_destination_repo.get_by_user_id(
            self.db,
            user_id,
            destination_type=destination_type,
        )

    async def create_destination(
        self,
        user_id: UUID,
        name: str,
        destination_type: str = "jobs",
        filter_rules: dict | None = None,
        parser_name: str | None = None,
        is_active: bool = True,
        priority: int = 0,
        always_keep: bool = False,
        queue_unsubscribe: bool = False,
        suggest_archive: bool = False,
        bucket_override: str | None = None,
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
            always_keep=always_keep,
            queue_unsubscribe=queue_unsubscribe,
            suggest_archive=suggest_archive,
            bucket_override=bucket_override,
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

    async def ensure_default_finance_destination(self, user_id: UUID) -> EmailDestination:
        """Ensure the user has a default 'Finance Alerts' destination.

        Creates one if it doesn't exist.
        """
        destinations = await email_destination_repo.get_by_user_id(self.db, user_id)

        for dest in destinations:
            if dest.destination_type == "finance":
                return dest

        return await email_destination_repo.create(
            self.db,
            user_id=user_id,
            name="Finance Alerts",
            destination_type="finance",
            filter_rules={
                "sender_patterns": DEFAULT_FINANCE_SENDERS,
            },
            parser_name=None,
            is_active=True,
            priority=0,
        )

    async def ensure_default_sync_schedule(self, user_id: UUID) -> Any:
        """Ensure the user has a default scheduled email sync."""
        tasks, _ = await scheduled_task_repo.get_by_user(
            self.db,
            user_id,
            pipeline_name="email_sync_jobs",
            skip=0,
            limit=1,
        )
        if tasks:
            return tasks[0]

        schedule_service = ScheduledTaskService(self.db)
        return await schedule_service.create_task(
            user_id,
            ScheduledTaskCreate(
                name="Email job sync",
                description="Default Gmail sync created when you connect email.",
                pipeline_name="email_sync_jobs",
                cron_expression=_build_default_sync_cron(settings.EMAIL_SYNC_INTERVAL_MINUTES),
                timezone="UTC",
                enabled=True,
                input_params=None,
                color="sky",
            ),
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

    async def list_triage_messages(
        self,
        user_id: UUID,
        *,
        bucket: str | None = None,
        source_id: UUID | None = None,
        requires_review: bool | None = None,
        unsubscribe_candidate: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[EmailMessage], int]:
        """List triaged email messages for a user."""
        if source_id:
            source = await email_source_repo.get_by_id(self.db, source_id)
            if source is None or source.user_id != user_id:
                raise NotFoundError(
                    message="Email source not found",
                    details={"id": str(source_id)},
                )

        return await email_source_repo.list_triage_messages_for_user(
            self.db,
            user_id,
            bucket=bucket,
            source_id=source_id,
            requires_review=requires_review,
            unsubscribe_candidate=unsubscribe_candidate,
            limit=limit,
            offset=offset,
        )

    async def get_triage_message(self, message_id: UUID, user_id: UUID) -> EmailMessage:
        """Get a triaged email message ensuring ownership."""
        message = await email_source_repo.get_triage_message_by_id_for_user(
            self.db,
            user_id,
            message_id,
        )
        if message is None:
            raise NotFoundError(message="Email message not found", details={"id": str(message_id)})
        return message

    async def get_triage_stats(self, user_id: UUID) -> dict[str, Any]:
        """Get aggregate triage stats for a user."""
        return await email_source_repo.get_triage_stats_for_user(self.db, user_id)

    async def review_triage_message(
        self,
        message_id: UUID,
        user_id: UUID,
        *,
        decision: str,
        bucket: str | None = None,
        reason: str | None = None,
    ) -> EmailMessage:
        """Resolve a review-required triage message."""
        if decision not in {"reviewed", "ignored"}:
            raise BadRequestError(message="Unsupported review decision")

        message = await self.get_triage_message(message_id, user_id)
        previous_bucket = message.bucket
        final_bucket = bucket or message.bucket
        final_unsubscribe = message.unsubscribe_candidate if final_bucket == "newsletter" else False
        final_archive = should_archive_recommend(
            final_bucket,
            message.triage_confidence,
            message.actionability_score,
            message.is_vip,
        )
        now = datetime.now(UTC)

        updated = await email_source_repo.update_message_triage(
            self.db,
            message,
            bucket=final_bucket,
            triage_status=decision,
            requires_review=False,
            unsubscribe_candidate=final_unsubscribe,
            archive_recommended=final_archive,
            last_action_at=now,
        )
        await self._create_action_log(
            user_id=user_id,
            message=updated,
            action_type="triage_review",
            action_status="approved" if decision == "reviewed" else "dismissed",
            action_source="user",
            reason=reason,
            metadata={
                "decision": decision,
                "previous_bucket": previous_bucket,
                "bucket": final_bucket,
            },
        )
        return updated

    async def list_subscription_groups(
        self,
        user_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        """Group cleanup candidates by sender domain, excluding covered rules."""
        messages = await self._list_cleanup_candidate_messages(user_id)
        cleanup_rules = await email_destination_repo.get_active_by_user_id(
            self.db,
            user_id,
            destination_type="cleanup",
        )

        grouped: dict[str, dict[str, Any]] = {}
        for message in messages:
            if any(
                email_destination_repo.matches_email(rule, message.from_address, message.subject)
                for rule in cleanup_rules
            ):
                continue

            domain = sender_domain(message.from_address) or normalize_sender(message.from_address)
            normalized = normalize_sender(message.from_address)
            if domain is None or normalized is None:
                continue

            group = grouped.setdefault(
                domain,
                {
                    "sender_domain": domain,
                    "representative_sender": normalized,
                    "representative_message_id": message.id,
                    "total_messages": 0,
                    "unsubscribe_count": 0,
                    "archive_count": 0,
                    "latest_received_at": message.received_at,
                    "sample_messages": [],
                },
            )
            group["total_messages"] += 1
            if message.unsubscribe_candidate:
                group["unsubscribe_count"] += 1
            if message.archive_recommended:
                group["archive_count"] += 1
            if group["latest_received_at"] is None or (
                message.received_at and message.received_at > group["latest_received_at"]
            ):
                group["latest_received_at"] = message.received_at
                group["representative_message_id"] = message.id
                group["representative_sender"] = normalized

            previews = group["sample_messages"]
            previews.append(message)
            previews.sort(
                key=lambda item: item.received_at or datetime.min.replace(tzinfo=UTC),
                reverse=True,
            )
            del previews[3:]

        ordered = sorted(
            grouped.values(),
            key=lambda item: item["latest_received_at"] or datetime.min.replace(tzinfo=UTC),
            reverse=True,
        )
        total = len(ordered)
        return ordered[offset : offset + limit], total

    async def approve_subscription_group(
        self,
        message_id: UUID,
        user_id: UUID,
        *,
        reason: str | None = None,
    ) -> EmailDestination:
        """Approve a cleanup suggestion by creating/updating a cleanup rule."""
        message = await self.get_triage_message(message_id, user_id)
        self._require_cleanup_candidate(message)
        rule, created = await self._upsert_cleanup_rule(
            user_id,
            message,
            always_keep=False,
            queue_unsubscribe=message.unsubscribe_candidate,
            suggest_archive=message.archive_recommended,
        )
        await email_source_repo.update_message_triage(
            self.db,
            message,
            last_action_at=datetime.now(UTC),
        )
        await self._create_action_log(
            user_id=user_id,
            message=message,
            action_type="cleanup_rule",
            action_status="approved",
            action_source="user",
            reason=reason,
            metadata={
                "rule_id": str(rule.id),
                "rule_created": created,
                "queue_unsubscribe": rule.queue_unsubscribe,
                "suggest_archive": rule.suggest_archive,
                "always_keep": rule.always_keep,
            },
        )
        return rule

    async def dismiss_subscription_group(
        self,
        message_id: UUID,
        user_id: UUID,
        *,
        reason: str | None = None,
    ) -> EmailDestination:
        """Dismiss a cleanup suggestion by creating/updating an always-keep rule."""
        message = await self.get_triage_message(message_id, user_id)
        self._require_cleanup_candidate(message)
        rule, created = await self._upsert_cleanup_rule(
            user_id,
            message,
            always_keep=True,
            queue_unsubscribe=False,
            suggest_archive=False,
        )
        await email_source_repo.update_message_triage(
            self.db,
            message,
            last_action_at=datetime.now(UTC),
        )
        await self._create_action_log(
            user_id=user_id,
            message=message,
            action_type="cleanup_rule",
            action_status="dismissed",
            action_source="user",
            reason=reason,
            metadata={
                "rule_id": str(rule.id),
                "rule_created": created,
                "queue_unsubscribe": rule.queue_unsubscribe,
                "suggest_archive": rule.suggest_archive,
                "always_keep": rule.always_keep,
            },
        )
        return rule

    # === Phase 4: Gmail Action Executor ===

    async def execute_action(
        self,
        message: EmailMessage,
        user_id: UUID,
        gmail: GmailClient,
        *,
        action_type: str,
        action_source: str = "user",
        label_name: str | None = None,
        reason: str | None = None,
    ) -> EmailActionLog:
        """Execute a Gmail action on a message with full audit logging.

        Validates policy, executes via GmailClient, logs the action with
        previous state for undo support.
        """
        gmail_message_id = message.gmail_message_id

        # Policy: trash requires an explicit cleanup rule
        if action_type == "trash":
            await self._require_trash_rule(user_id, message)

        # Policy: VIP messages cannot be auto-actioned
        if action_source == "system" and message.is_vip:
            raise BadRequestError(message="VIP messages cannot be auto-actioned")

        previous_labels: list[str] = []
        applied_labels: list[str] = []
        removed_labels: list[str] = []

        if action_type == "archive":
            bucket_label_name = AUTOMATION_LABELS.get(message.bucket or "")
            add_ids: list[str] = []
            if bucket_label_name:
                label_id = await gmail.get_or_create_label(bucket_label_name)
                add_ids = [label_id]
                applied_labels = [bucket_label_name]
            previous_labels = await gmail.modify_message(
                gmail_message_id,
                add_label_ids=add_ids or None,
                remove_label_ids=["INBOX"],
            )
            removed_labels = ["INBOX"]

        elif action_type == "mark_read":
            previous_labels = await gmail.modify_message(
                gmail_message_id,
                remove_label_ids=["UNREAD"],
            )
            removed_labels = ["UNREAD"]

        elif action_type == "label":
            if not label_name:
                raise BadRequestError(message="label_name is required for 'label' action")
            label_id = await gmail.get_or_create_label(label_name)
            previous_labels = await gmail.modify_message(
                gmail_message_id,
                add_label_ids=[label_id],
            )
            applied_labels = [label_name]

        elif action_type == "trash":
            previous_labels = await gmail.trash(gmail_message_id)

        else:
            raise BadRequestError(message=f"Unsupported action type: {action_type}")

        now = datetime.now(UTC)
        await email_source_repo.update_message_triage(
            self.db, message, triage_status="actioned", last_action_at=now
        )

        return await self._create_action_log(
            user_id=user_id,
            message=message,
            action_type=action_type,
            action_status="applied",
            action_source=action_source,
            reason=reason,
            metadata={
                "previous_labels": previous_labels,
                "applied_labels": applied_labels,
                "removed_labels": removed_labels,
            },
        )

    async def undo_last_action(
        self,
        message: EmailMessage,
        user_id: UUID,
        gmail: GmailClient,
    ) -> EmailActionLog:
        """Undo the last applied action on a message."""
        last_log = None
        # Search across all undoable action types for the most recent
        for action_type in ("archive", "mark_read", "trash", "label"):
            candidate = await email_action_log_repo.get_by_message_action(
                self.db,
                user_id=user_id,
                message_id=message.id,
                action_type=action_type,
                action_status="applied",
            )
            if candidate is not None and (
                last_log is None or candidate.created_at > last_log.created_at
            ):
                last_log = candidate

        if last_log is None:
            raise NotFoundError(message="No undoable action found for this message")

        meta = last_log.action_metadata or {}
        previous_labels = meta.get("previous_labels", [])
        applied_labels = meta.get("applied_labels", [])
        removed_labels = meta.get("removed_labels", [])

        gmail_message_id = message.gmail_message_id

        if last_log.action_type == "trash":
            await gmail.untrash(gmail_message_id)
        else:
            # Reverse: re-add removed labels, remove applied labels
            re_add = [lid for lid in removed_labels if lid in previous_labels]
            re_remove: list[str] = []
            # For applied labels that are label names, resolve IDs
            for lname in applied_labels:
                try:
                    lid = await gmail.get_or_create_label(lname)
                    re_remove.append(lid)
                except Exception:
                    pass
            if re_add or re_remove:
                await gmail.modify_message(
                    gmail_message_id,
                    add_label_ids=re_add or None,
                    remove_label_ids=re_remove or None,
                )

        # Mark original log as undone
        last_log.action_status = "undone"
        self.db.add(last_log)
        await self.db.flush()

        now = datetime.now(UTC)
        await email_source_repo.update_message_triage(
            self.db, message, triage_status="classified", last_action_at=now
        )

        return await self._create_action_log(
            user_id=user_id,
            message=message,
            action_type="undo",
            action_status="applied",
            action_source="user",
            metadata={
                "undone_action_id": str(last_log.id),
                "undone_action_type": last_log.action_type,
            },
        )

    async def get_gmail_client_for_message(self, message: EmailMessage) -> GmailClient:
        """Build a GmailClient from the source associated with a message."""
        source = await email_source_repo.get_by_id(self.db, message.source_id)
        if source is None:
            raise NotFoundError(message="Email source not found")
        access_token, refresh_token = email_source_repo.get_decrypted_tokens(source)
        return GmailClient(
            access_token=access_token,
            refresh_token=refresh_token,
            token_expiry=source.token_expiry,
        )

    async def save_refreshed_tokens(self, gmail: GmailClient, message: EmailMessage) -> None:
        """Persist refreshed OAuth tokens if the GmailClient refreshed them."""
        if gmail.tokens_refreshed and gmail.new_access_token:
            source = await email_source_repo.get_by_id(self.db, message.source_id)
            if source:
                await email_source_repo.update_tokens(
                    self.db, source, gmail.new_access_token, gmail.new_token_expiry
                )

    async def get_source_auto_action_settings(
        self,
        source_id: UUID,
        user_id: UUID,
    ):
        """Get auto-action settings for an email source."""
        source = await email_source_repo.get_by_id(self.db, source_id)
        if source is None or source.user_id != user_id:
            raise NotFoundError(message="Email source not found")
        return source

    async def update_source_auto_action_settings(
        self,
        source_id: UUID,
        user_id: UUID,
        *,
        auto_actions_enabled: bool | None = None,
        auto_action_confidence_threshold: float | None = None,
    ):
        """Update auto-action settings on an email source."""
        source = await email_source_repo.get_by_id(self.db, source_id)
        if source is None or source.user_id != user_id:
            raise NotFoundError(message="Email source not found")
        if auto_actions_enabled is not None:
            source.auto_actions_enabled = auto_actions_enabled
        if auto_action_confidence_threshold is not None:
            source.auto_action_confidence_threshold = auto_action_confidence_threshold
        self.db.add(source)
        await self.db.flush()
        await self.db.refresh(source)
        return source

    async def _require_trash_rule(self, user_id: UUID, message: EmailMessage) -> None:
        """Ensure an explicit cleanup rule exists that covers this sender before trashing."""
        rules = await email_destination_repo.find_matching_destinations(
            self.db,
            user_id,
            message.from_address,
            message.subject,
            destination_type="cleanup",
        )
        if not rules:
            raise BadRequestError(
                message="Trash requires an explicit sender rule. Create a cleanup rule first."
            )

    async def list_action_logs(
        self,
        user_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[EmailActionLog], int]:
        """List cleanup action logs for a user."""
        return await email_action_log_repo.list_by_user(
            self.db,
            user_id,
            limit=limit,
            offset=offset,
        )

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
        self,
        user_id: UUID,
        from_address: str,
        subject: str | None,
        *,
        destination_type: str | None = None,
    ) -> list[EmailDestination]:
        """Find all destinations that match an email."""
        return await email_destination_repo.find_matching_destinations(
            self.db,
            user_id,
            from_address,
            subject,
            destination_type=destination_type,
        )

    async def process_email_for_destination(
        self,
        message: EmailMessage,
        destination: EmailDestination,
        email_content: dict,
        job_service: JobService,
        profile_id: UUID | None = None,
    ) -> dict[str, Any]:
        """Process an email for a specific destination.

        Returns processing results including items extracted.
        """
        results: dict[str, Any] = {
            "items_extracted": 0,
            "jobs_analyzed": 0,
            "jobs_saved": 0,
            "jobs_filtered": 0,
            "high_scoring": 0,
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
                        )
                        results["jobs_analyzed"] = ingestion.jobs_analyzed
                        results["jobs_saved"] = ingestion.jobs_saved
                        results["jobs_filtered"] = (
                            ingestion.jobs_received
                            - ingestion.jobs_saved
                            - ingestion.duplicates_skipped
                        )
                        results["high_scoring"] = ingestion.high_scoring
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

    async def _upsert_cleanup_rule(
        self,
        user_id: UUID,
        message: EmailMessage,
        *,
        always_keep: bool,
        queue_unsubscribe: bool,
        suggest_archive: bool,
    ) -> tuple[EmailDestination, bool]:
        """Create or update a sender-domain cleanup rule for a message."""
        pattern = sender_domain(message.from_address) or normalize_sender(message.from_address)
        if pattern is None:
            raise BadRequestError(message="Could not determine a sender pattern for this message")

        cleanup_rules = await email_destination_repo.get_by_user_id(
            self.db,
            user_id,
            destination_type="cleanup",
        )
        matching_rule = None
        for rule in cleanup_rules:
            sender_patterns = (rule.filter_rules or {}).get("sender_patterns", [])
            if any(
                sender_matches_pattern(message.from_address, sender_pattern)
                for sender_pattern in sender_patterns
            ):
                matching_rule = rule
                break

        filter_rules = {
            "sender_patterns": [pattern],
            "subject_contains": [],
            "subject_not_contains": [],
        }
        if matching_rule is not None:
            updated = await email_destination_repo.update(
                self.db,
                matching_rule,
                filter_rules=matching_rule.filter_rules or filter_rules,
                is_active=True,
                priority=max(matching_rule.priority, DEFAULT_CLEANUP_PRIORITY),
                always_keep=always_keep,
                queue_unsubscribe=queue_unsubscribe,
                suggest_archive=suggest_archive,
            )
            return updated, False

        created = await email_destination_repo.create(
            self.db,
            user_id=user_id,
            name=_cleanup_rule_name(pattern),
            destination_type="cleanup",
            filter_rules=filter_rules,
            parser_name=None,
            is_active=True,
            priority=DEFAULT_CLEANUP_PRIORITY,
            always_keep=always_keep,
            queue_unsubscribe=queue_unsubscribe,
            suggest_archive=suggest_archive,
            bucket_override=None,
        )
        return created, True

    async def _list_cleanup_candidate_messages(self, user_id: UUID) -> list[EmailMessage]:
        """Fetch all cleanup candidates in batches so grouping stays correct."""
        messages: list[EmailMessage] = []
        offset = 0
        total: int | None = None

        while total is None or offset < total:
            batch, total = await email_source_repo.list_cleanup_candidate_messages_for_user(
                self.db,
                user_id,
                limit=CLEANUP_GROUP_BATCH_SIZE,
                offset=offset,
            )
            if not batch:
                break
            messages.extend(batch)
            offset += len(batch)

        return messages

    def _require_cleanup_candidate(self, message: EmailMessage) -> None:
        """Ensure subscription actions only target current cleanup candidates."""
        if message.unsubscribe_candidate or message.archive_recommended:
            return
        raise BadRequestError(message="Email message is not a cleanup candidate")

    async def _create_action_log(
        self,
        *,
        user_id: UUID,
        message: EmailMessage | None,
        action_type: str,
        action_status: str,
        action_source: str,
        reason: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> EmailActionLog:
        """Create a cleanup audit record with normalized sender metadata."""
        return await email_action_log_repo.create(
            self.db,
            user_id=user_id,
            message_id=message.id if message else None,
            gmail_thread_id=message.gmail_thread_id if message else None,
            normalized_sender=normalize_sender(message.from_address) if message else None,
            sender_domain=sender_domain(message.from_address) if message else None,
            action_type=action_type,
            action_status=action_status,
            action_source=action_source,
            reason=reason,
            metadata=metadata,
        )
