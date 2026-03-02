"""Finance Email Sync Pipeline.

Syncs financial transactions from connected Gmail accounts by parsing
bank alerts, billing emails, and subscription receipts.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import ClassVar
from uuid import UUID

from pydantic import BaseModel, Field

from app.clients.gmail import GmailClient
from app.core.config import settings
from app.db.session import get_db_context
from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.registry import register_pipeline
from app.repositories import email_source_repo, finance_repo

logger = logging.getLogger(__name__)

# Financial email sender patterns to search for
FINANCIAL_SENDER_PATTERNS = [
    "noreply@chase.com",
    "alerts@bankofamerica.com",
    "service@paypal.com",
    "noreply@venmo.com",
    "no-reply@apple.com",
    "noreply@netflix.com",
    "billing@",
    "receipt@",
    "invoice@",
    "statement@",
    "alerts@",
    "noreply@discover.com",
    "noreply@citibank.com",
    "noreply@wellsfargo.com",
    "service@stripe.com",
]


class FinanceEmailSyncInput(BaseModel):
    account_id: UUID | None = Field(
        default=None,
        description="Optional account ID to link imported transactions to.",
    )
    lookback_hours: int = Field(
        default=72,
        ge=1,
        le=720,
        description="How many hours back to scan for financial emails.",
    )
    source_id: UUID | None = Field(
        default=None,
        description="Specific email source to sync. If not provided, syncs all active sources.",
    )


class FinanceEmailSyncOutput(BaseModel):
    emails_scanned: int = 0
    emails_with_transactions: int = 0
    transactions_found: int = 0
    transactions_imported: int = 0
    duplicates_skipped: int = 0
    sources_synced: int = 0
    errors: list[str] = Field(default_factory=list)


@register_pipeline
class FinanceEmailSyncPipeline(ActionPipeline[FinanceEmailSyncInput, FinanceEmailSyncOutput]):
    """Finance email sync pipeline.

    Scans connected Gmail accounts for financial emails (bank alerts, receipts,
    billing notifications) and extracts transaction data using OpenAI.

    Prerequisites:
    - User must have a connected Gmail account (EmailSource)
    - OPENAI_API_KEY must be configured

    Can be triggered via:
    - API: POST /api/v1/pipelines/finance_email_sync/execute
    - Scheduled: Daily cron via pipeline scheduler
    - Finance area assistant
    """

    name = "finance_email_sync"
    description = "Scan Gmail for bank alerts and receipts to import financial transactions"
    tags: ClassVar[list[str]] = ["finances", "email", "ai"]
    area: ClassVar[str | None] = "finances"

    async def execute(
        self,
        input: FinanceEmailSyncInput,
        context: PipelineContext,
    ) -> ActionResult[FinanceEmailSyncOutput]:
        if context.user_id is None:
            return ActionResult(success=False, error="User authentication required")

        output = FinanceEmailSyncOutput()
        errors: list[str] = []

        async with get_db_context() as db:
            # Get email sources to scan
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
                    output=FinanceEmailSyncOutput(
                        errors=["No active email sources found. Connect your Gmail first."]
                    ),
                )

            cutoff = datetime.now(UTC) - timedelta(hours=input.lookback_hours)

            for source in sources:
                try:
                    result = await self._sync_source(
                        db=db,
                        source=source,
                        user_id=context.user_id,
                        cutoff=cutoff,
                        account_id=input.account_id,
                    )
                    output.emails_scanned += result["emails_scanned"]
                    output.emails_with_transactions += result["emails_with_transactions"]
                    output.transactions_found += result["transactions_found"]
                    output.transactions_imported += result["transactions_imported"]
                    output.duplicates_skipped += result["duplicates_skipped"]
                    output.sources_synced += 1

                except Exception as e:
                    msg = f"Error syncing {source.email_address}: {e}"
                    logger.exception(msg)
                    errors.append(msg)

            await db.commit()

        output.errors = errors
        return ActionResult(
            success=len(errors) == 0,
            output=output,
            error="; ".join(errors) if errors else None,
            metadata={
                "sources_scanned": len(sources),
                "transactions_imported": output.transactions_imported,
            },
        )

    async def _sync_source(
        self,
        db,
        source,
        user_id: UUID,
        cutoff: datetime,
        account_id: UUID | None,
    ) -> dict:
        from app.pipelines.actions.finance_email_sync.parser import parse_transaction_email
        from app.services.finance_service import FinanceService

        result = {
            "emails_scanned": 0,
            "emails_with_transactions": 0,
            "transactions_found": 0,
            "transactions_imported": 0,
            "duplicates_skipped": 0,
        }

        finance_service = FinanceService(db)

        access_token, refresh_token = email_source_repo.get_decrypted_tokens(source)
        gmail = GmailClient(
            access_token=access_token,
            refresh_token=refresh_token,
            token_expiry=source.token_expiry,
        )

        query = gmail.build_sender_query(FINANCIAL_SENDER_PATTERNS, after_timestamp=cutoff)
        messages = await gmail.list_messages(query, max_results=200)
        logger.info(
            "Finance email sync: %d messages found for %s", len(messages), source.email_address
        )

        for msg_info in messages:
            message_id = msg_info["id"]

            # Check if already processed as a finance transaction
            existing = await finance_repo.get_by_raw_email_id(db, user_id, message_id)
            if existing:
                result["duplicates_skipped"] += 1
                continue

            try:
                email_content = await gmail.get_message(message_id)
                result["emails_scanned"] += 1

                parsed = await parse_transaction_email(
                    subject=email_content.subject,
                    body_text=email_content.body_text or "",
                    body_html=email_content.body_html or "",
                    openai_api_key=settings.OPENAI_API_KEY,
                )

                if not parsed:
                    continue

                result["emails_with_transactions"] += 1
                result["transactions_found"] += len(parsed)

                # Attach raw_email_id for deduplication and optional account link
                for tx in parsed:
                    tx["raw_email_id"] = message_id
                    if account_id:
                        tx["account_id"] = account_id

                imported, skipped = await finance_service.ingest_from_email(user_id, parsed)
                result["transactions_imported"] += imported
                result["duplicates_skipped"] += skipped

            except Exception as e:
                logger.warning("Error processing message %s: %s", message_id, e)

        # Update tokens if refreshed
        if gmail.tokens_refreshed and gmail.new_access_token:
            await email_source_repo.update_tokens(
                db, source, gmail.new_access_token, gmail.new_token_expiry
            )

        return result
