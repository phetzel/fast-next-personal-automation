"""Repository for email source operations."""

import logging
from datetime import datetime
from uuid import UUID

from cryptography.fernet import InvalidToken
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_token, encrypt_token, is_encrypted
from app.db.models.email_message import EmailMessage
from app.db.models.email_source import EmailSource
from app.db.models.pipeline_run import PipelineRun, PipelineRunStatus

logger = logging.getLogger(__name__)


async def get_by_id(db: AsyncSession, source_id: UUID) -> EmailSource | None:
    """Get an email source by ID."""
    return await db.get(EmailSource, source_id)


async def get_by_user_id(db: AsyncSession, user_id: UUID) -> list[EmailSource]:
    """Get all email sources for a user."""
    result = await db.execute(
        select(EmailSource)
        .where(EmailSource.user_id == user_id)
        .order_by(EmailSource.created_at.desc())
    )
    return list(result.scalars().all())


async def get_active_by_user_id(db: AsyncSession, user_id: UUID) -> list[EmailSource]:
    """Get all active email sources for a user."""
    result = await db.execute(
        select(EmailSource)
        .where(EmailSource.user_id == user_id, EmailSource.is_active.is_(True))
        .order_by(EmailSource.created_at.desc())
    )
    return list(result.scalars().all())


async def get_all_active(db: AsyncSession) -> list[EmailSource]:
    """Get all active email sources across all users."""
    result = await db.execute(
        select(EmailSource)
        .where(EmailSource.is_active.is_(True))
        .order_by(EmailSource.last_sync_at.asc().nullsfirst())  # Oldest sync first
    )
    return list(result.scalars().all())


async def get_by_email_and_user(
    db: AsyncSession, email_address: str, user_id: UUID
) -> EmailSource | None:
    """Get an email source by email address and user."""
    result = await db.execute(
        select(EmailSource).where(
            EmailSource.email_address == email_address,
            EmailSource.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


def get_decrypted_tokens(source: EmailSource) -> tuple[str, str]:
    """Get decrypted access and refresh tokens for an email source.

    Handles both encrypted and legacy unencrypted tokens for backwards compatibility.

    Args:
        source: The email source with (possibly encrypted) tokens

    Returns:
        Tuple of (access_token, refresh_token) in plaintext
    """
    # Handle access token
    if is_encrypted(source.access_token):
        try:
            access_token = decrypt_token(source.access_token)
        except InvalidToken:
            logger.warning(f"Failed to decrypt access token for source {source.id}")
            access_token = source.access_token  # Fall back to raw value
    else:
        access_token = source.access_token

    # Handle refresh token
    if is_encrypted(source.refresh_token):
        try:
            refresh_token = decrypt_token(source.refresh_token)
        except InvalidToken:
            logger.warning(f"Failed to decrypt refresh token for source {source.id}")
            refresh_token = source.refresh_token  # Fall back to raw value
    else:
        refresh_token = source.refresh_token

    return access_token, refresh_token


async def create(
    db: AsyncSession,
    user_id: UUID,
    email_address: str,
    access_token: str,
    refresh_token: str,
    token_expiry: datetime | None = None,
    provider: str = "gmail",
    custom_senders: list[str] | None = None,
) -> EmailSource:
    """Create a new email source with encrypted tokens."""
    source = EmailSource(
        user_id=user_id,
        email_address=email_address,
        access_token=encrypt_token(access_token),
        refresh_token=encrypt_token(refresh_token),
        token_expiry=token_expiry,
        provider=provider,
        custom_senders=custom_senders,
    )
    db.add(source)
    await db.flush()
    await db.refresh(source)
    return source


async def update_tokens(
    db: AsyncSession,
    source: EmailSource,
    access_token: str,
    token_expiry: datetime | None = None,
    refresh_token: str | None = None,
) -> EmailSource:
    """Update OAuth tokens for an email source (encrypts tokens at rest)."""
    source.access_token = encrypt_token(access_token)
    if refresh_token:
        source.refresh_token = encrypt_token(refresh_token)
    if token_expiry:
        source.token_expiry = token_expiry
    db.add(source)
    await db.flush()
    await db.refresh(source)
    return source


async def update_sync_status(
    db: AsyncSession,
    source: EmailSource,
    last_sync_at: datetime,
    error: str | None = None,
) -> EmailSource:
    """Update sync status for an email source."""
    source.last_sync_at = last_sync_at
    source.last_sync_error = error
    db.add(source)
    await db.flush()
    await db.refresh(source)
    return source


async def update_triage_status(
    db: AsyncSession,
    source: EmailSource,
    *,
    last_triage_at: datetime | None = None,
    error: str | None = None,
) -> EmailSource:
    """Update triage status for an email source.

    `last_triage_at` should only be provided on successful source completion so the
    watermark reflects the last completed triage window.
    """
    if last_triage_at is not None:
        source.last_triage_at = last_triage_at
    source.last_triage_error = error
    db.add(source)
    await db.flush()
    await db.refresh(source)
    return source


async def update_custom_senders(
    db: AsyncSession,
    source: EmailSource,
    custom_senders: list[str] | None,
) -> EmailSource:
    """Update custom senders for an email source."""
    source.custom_senders = custom_senders
    db.add(source)
    await db.flush()
    await db.refresh(source)
    return source


async def set_active(
    db: AsyncSession,
    source: EmailSource,
    is_active: bool,
) -> EmailSource:
    """Enable or disable an email source."""
    source.is_active = is_active
    db.add(source)
    await db.flush()
    await db.refresh(source)
    return source


async def delete(db: AsyncSession, source: EmailSource) -> None:
    """Delete an email source and its messages."""
    await db.delete(source)
    await db.flush()


# Email Message operations


async def create_message(
    db: AsyncSession,
    source_id: UUID,
    gmail_message_id: str,
    gmail_thread_id: str | None,
    subject: str,
    from_address: str,
    received_at: datetime,
    processed_at: datetime,
    sync_id: UUID | None = None,
    to_address: str | None = None,
    jobs_extracted: int = 0,
    parser_used: str | None = None,
    processing_error: str | None = None,
) -> EmailMessage:
    """Create a processed email message record."""
    message = EmailMessage(
        source_id=source_id,
        sync_id=sync_id,
        gmail_message_id=gmail_message_id,
        gmail_thread_id=gmail_thread_id,
        subject=subject,
        from_address=from_address,
        to_address=to_address,
        received_at=received_at,
        processed_at=processed_at,
        jobs_extracted=jobs_extracted,
        parser_used=parser_used,
        processing_error=processing_error,
    )
    db.add(message)
    await db.flush()
    await db.refresh(message)
    return message


async def get_or_create_message(
    db: AsyncSession,
    source_id: UUID,
    gmail_message_id: str,
    gmail_thread_id: str | None,
    subject: str | None,
    from_address: str,
    received_at: datetime | None,
    processed_at: datetime | None,
    sync_id: UUID | None = None,
    to_address: str | None = None,
    jobs_extracted: int = 0,
    parser_used: str | None = None,
    processing_error: str | None = None,
) -> tuple[EmailMessage, bool]:
    """Get an existing processed email record or create it once.

    Uses a nested transaction so unique-constraint collisions only roll back the
    message insert, not the surrounding sync transaction.
    """
    existing = await get_message_by_gmail_id(db, source_id, gmail_message_id)
    if existing is not None:
        return existing, False

    message = EmailMessage(
        source_id=source_id,
        sync_id=sync_id,
        gmail_message_id=gmail_message_id,
        gmail_thread_id=gmail_thread_id,
        subject=subject,
        from_address=from_address,
        to_address=to_address,
        received_at=received_at,
        processed_at=processed_at,
        jobs_extracted=jobs_extracted,
        parser_used=parser_used,
        processing_error=processing_error,
    )

    try:
        async with db.begin_nested():
            db.add(message)
            await db.flush()
        await db.refresh(message)
        return message, True
    except IntegrityError:
        logger.info(
            "Email message already claimed during concurrent sync",
            extra={
                "source_id": str(source_id),
                "gmail_message_id": gmail_message_id,
            },
        )
        existing = await get_message_by_gmail_id(db, source_id, gmail_message_id)
        if existing is None:
            raise
        return existing, False


async def update_message_processing(
    db: AsyncSession,
    message: EmailMessage,
    *,
    processed_at: datetime | None = None,
    jobs_extracted: int | None = None,
    parser_used: str | None = None,
    processing_error: str | None = None,
) -> EmailMessage:
    """Update aggregate processing fields on an email message."""
    if processed_at is not None:
        message.processed_at = processed_at
    if jobs_extracted is not None:
        message.jobs_extracted = jobs_extracted
    message.parser_used = parser_used
    message.processing_error = processing_error
    db.add(message)
    await db.flush()
    await db.refresh(message)
    return message


async def update_message_triage(
    db: AsyncSession,
    message: EmailMessage,
    *,
    gmail_thread_id: str | None = None,
    subject: str | None = None,
    from_address: str | None = None,
    to_address: str | None = None,
    received_at: datetime | None = None,
    bucket: str | None = None,
    triage_status: str | None = None,
    triage_confidence: float | None = None,
    actionability_score: float | None = None,
    summary: str | None = None,
    requires_review: bool | None = None,
    unsubscribe_candidate: bool | None = None,
    archive_recommended: bool | None = None,
    is_vip: bool | None = None,
    triaged_at: datetime | None = None,
    last_action_at: datetime | None = None,
) -> EmailMessage:
    """Update triage fields and refreshed metadata on an email message."""
    if gmail_thread_id is not None:
        message.gmail_thread_id = gmail_thread_id
    if subject is not None:
        message.subject = subject
    if from_address is not None:
        message.from_address = from_address
    if to_address is not None:
        message.to_address = to_address
    if received_at is not None:
        message.received_at = received_at
    if bucket is not None:
        message.bucket = bucket
    if triage_status is not None:
        message.triage_status = triage_status
    if triage_confidence is not None:
        message.triage_confidence = triage_confidence
    if actionability_score is not None:
        message.actionability_score = actionability_score
    if summary is not None:
        message.summary = summary
    if requires_review is not None:
        message.requires_review = requires_review
    if unsubscribe_candidate is not None:
        message.unsubscribe_candidate = unsubscribe_candidate
    if archive_recommended is not None:
        message.archive_recommended = archive_recommended
    if is_vip is not None:
        message.is_vip = is_vip
    if triaged_at is not None:
        message.triaged_at = triaged_at
    if last_action_at is not None:
        message.last_action_at = last_action_at
    db.add(message)
    await db.flush()
    await db.refresh(message)
    return message


async def get_message_by_gmail_id(
    db: AsyncSession, source_id: UUID, gmail_message_id: str
) -> EmailMessage | None:
    """Check if a Gmail message has already been processed."""
    result = await db.execute(
        select(EmailMessage).where(
            EmailMessage.source_id == source_id,
            EmailMessage.gmail_message_id == gmail_message_id,
        )
    )
    return result.scalar_one_or_none()


async def get_messages_by_source(
    db: AsyncSession, source_id: UUID, limit: int = 100
) -> list[EmailMessage]:
    """Get recent messages for an email source."""
    result = await db.execute(
        select(EmailMessage)
        .where(EmailMessage.source_id == source_id)
        .order_by(EmailMessage.processed_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def list_triage_messages_for_user(
    db: AsyncSession,
    user_id: UUID,
    *,
    bucket: str | None = None,
    source_id: UUID | None = None,
    requires_review: bool | None = None,
    unsubscribe_candidate: bool | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[EmailMessage], int]:
    """List triaged email messages for a user with filtering."""
    conditions = [
        EmailSource.user_id == user_id,
        EmailMessage.triaged_at.is_not(None),
    ]
    if bucket:
        conditions.append(EmailMessage.bucket == bucket)
    if source_id:
        conditions.append(EmailMessage.source_id == source_id)
    if requires_review is not None:
        conditions.append(EmailMessage.requires_review.is_(requires_review))
    if unsubscribe_candidate is not None:
        conditions.append(EmailMessage.unsubscribe_candidate.is_(unsubscribe_candidate))

    query = (
        select(EmailMessage)
        .join(EmailSource, EmailSource.id == EmailMessage.source_id)
        .where(*conditions)
        .order_by(EmailMessage.received_at.desc().nullslast(), EmailMessage.created_at.desc())
    )
    total = await db.scalar(select(func.count()).select_from(query.subquery())) or 0
    result = await db.execute(query.offset(offset).limit(limit))
    return list(result.scalars().all()), total


async def list_cleanup_candidate_messages_for_user(
    db: AsyncSession,
    user_id: UUID,
    *,
    limit: int = 1000,
    offset: int = 0,
) -> tuple[list[EmailMessage], int]:
    """List cleanup candidate messages for a user."""
    conditions = [
        EmailSource.user_id == user_id,
        EmailMessage.triaged_at.is_not(None),
        (EmailMessage.unsubscribe_candidate.is_(True) | EmailMessage.archive_recommended.is_(True)),
    ]

    query = (
        select(EmailMessage)
        .join(EmailSource, EmailSource.id == EmailMessage.source_id)
        .where(*conditions)
        .order_by(EmailMessage.received_at.desc().nullslast(), EmailMessage.created_at.desc())
    )
    total = await db.scalar(select(func.count()).select_from(query.subquery())) or 0
    result = await db.execute(query.offset(offset).limit(limit))
    return list(result.scalars().all()), total


async def get_triage_message_by_id_for_user(
    db: AsyncSession,
    user_id: UUID,
    message_id: UUID,
) -> EmailMessage | None:
    """Get a single triaged email message ensuring the owning user matches."""
    result = await db.execute(
        select(EmailMessage)
        .join(EmailSource, EmailSource.id == EmailMessage.source_id)
        .where(
            EmailMessage.id == message_id,
            EmailSource.user_id == user_id,
            EmailMessage.triaged_at.is_not(None),
        )
    )
    return result.scalar_one_or_none()


async def get_message_by_id_for_user(
    db: AsyncSession,
    user_id: UUID,
    message_id: UUID,
) -> EmailMessage | None:
    """Get a single email message ensuring the owning user matches."""
    result = await db.execute(
        select(EmailMessage)
        .join(EmailSource, EmailSource.id == EmailMessage.source_id)
        .where(
            EmailMessage.id == message_id,
            EmailSource.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def get_triage_stats_for_user(
    db: AsyncSession,
    user_id: UUID,
) -> dict:
    """Return aggregate triage counts for a user."""
    base_conditions = [
        EmailSource.user_id == user_id,
        EmailMessage.triaged_at.is_not(None),
    ]

    by_bucket_query = (
        select(EmailMessage.bucket, func.count())
        .join(EmailSource, EmailSource.id == EmailMessage.source_id)
        .where(*base_conditions, EmailMessage.bucket.is_not(None))
        .group_by(EmailMessage.bucket)
    )
    by_bucket_result = await db.execute(by_bucket_query)
    by_bucket = {(bucket or "unbucketed"): count for bucket, count in by_bucket_result.all()}

    total_triaged = (
        await db.scalar(
            select(func.count())
            .select_from(EmailMessage)
            .join(EmailSource, EmailSource.id == EmailMessage.source_id)
            .where(*base_conditions, EmailMessage.bucket.is_not(None))
        )
        or 0
    )

    review_count = (
        await db.scalar(
            select(func.count())
            .select_from(EmailMessage)
            .join(EmailSource, EmailSource.id == EmailMessage.source_id)
            .where(*base_conditions, EmailMessage.requires_review.is_(True))
        )
        or 0
    )

    unsubscribe_count = (
        await db.scalar(
            select(func.count())
            .select_from(EmailMessage)
            .join(EmailSource, EmailSource.id == EmailMessage.source_id)
            .where(*base_conditions, EmailMessage.unsubscribe_candidate.is_(True))
        )
        or 0
    )

    last_run_result = await db.execute(
        select(PipelineRun)
        .where(
            PipelineRun.pipeline_name == "email_triage",
            PipelineRun.user_id == user_id,
            PipelineRun.status == PipelineRunStatus.SUCCESS,
        )
        .order_by(PipelineRun.completed_at.desc().nullslast(), PipelineRun.created_at.desc())
        .limit(1)
    )
    last_run = last_run_result.scalar_one_or_none()

    return {
        "by_bucket": by_bucket,
        "total_triaged": total_triaged,
        "review_count": review_count,
        "unsubscribe_count": unsubscribe_count,
        "last_run": last_run,
    }


async def get_message_stats(db: AsyncSession, source_id: UUID) -> dict:
    """Get statistics for an email source."""
    messages = await get_messages_by_source(db, source_id, limit=1000)

    total_messages = len(messages)
    total_jobs = sum(m.jobs_extracted for m in messages)
    successful = sum(1 for m in messages if m.processing_error is None)
    failed = total_messages - successful

    return {
        "total_messages": total_messages,
        "total_jobs_extracted": total_jobs,
        "successful_parses": successful,
        "failed_parses": failed,
    }
