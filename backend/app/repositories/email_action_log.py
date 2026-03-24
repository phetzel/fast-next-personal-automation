"""Repository helpers for email cleanup action logs."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.email_action_log import EmailActionLog


async def create(
    db: AsyncSession,
    *,
    user_id: UUID,
    message_id: UUID | None = None,
    gmail_thread_id: str | None = None,
    normalized_sender: str | None = None,
    sender_domain: str | None = None,
    action_type: str,
    action_status: str,
    action_source: str,
    reason: str | None = None,
    metadata: dict | None = None,
) -> EmailActionLog:
    """Create an email cleanup audit entry."""
    log = EmailActionLog(
        user_id=user_id,
        message_id=message_id,
        gmail_thread_id=gmail_thread_id,
        normalized_sender=normalized_sender,
        sender_domain=sender_domain,
        action_type=action_type,
        action_status=action_status,
        action_source=action_source,
        reason=reason,
        action_metadata=metadata,
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)
    return log


async def get_by_message_action(
    db: AsyncSession,
    *,
    user_id: UUID,
    message_id: UUID,
    action_type: str,
    action_status: str | None = None,
    action_source: str | None = None,
) -> EmailActionLog | None:
    """Find the latest action log for a message/action tuple."""
    conditions = [
        EmailActionLog.user_id == user_id,
        EmailActionLog.message_id == message_id,
        EmailActionLog.action_type == action_type,
    ]
    if action_status is not None:
        conditions.append(EmailActionLog.action_status == action_status)
    if action_source is not None:
        conditions.append(EmailActionLog.action_source == action_source)

    result = await db.execute(
        select(EmailActionLog)
        .where(*conditions)
        .order_by(EmailActionLog.created_at.desc(), EmailActionLog.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def list_by_user(
    db: AsyncSession,
    user_id: UUID,
    *,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[EmailActionLog], int]:
    """List cleanup audit logs for a user."""
    query = (
        select(EmailActionLog)
        .where(EmailActionLog.user_id == user_id)
        .order_by(EmailActionLog.created_at.desc(), EmailActionLog.id.desc())
    )
    total = await db.scalar(select(func.count()).select_from(query.subquery())) or 0
    result = await db.execute(query.offset(offset).limit(limit))
    return list(result.scalars().all()), total
