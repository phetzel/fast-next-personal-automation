"""Repository for email source operations."""

import logging
from datetime import datetime
from uuid import UUID

from cryptography.fernet import InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_token, encrypt_token, is_encrypted
from app.db.models.email_message import EmailMessage
from app.db.models.email_source import EmailSource

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
) -> EmailSource:
    """Update OAuth tokens for an email source (encrypts the token)."""
    source.access_token = encrypt_token(access_token)
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
    jobs_extracted: int = 0,
    parser_used: str | None = None,
    processing_error: str | None = None,
) -> EmailMessage:
    """Create a processed email message record."""
    message = EmailMessage(
        source_id=source_id,
        gmail_message_id=gmail_message_id,
        gmail_thread_id=gmail_thread_id,
        subject=subject,
        from_address=from_address,
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
