"""Repository for email sync operations."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.email_sync import EmailSync


async def get_by_id(db: AsyncSession, sync_id: UUID) -> EmailSync | None:
    """Get an email sync by ID."""
    return await db.get(EmailSync, sync_id)


async def get_by_user_id(
    db: AsyncSession, user_id: UUID, limit: int = 50, offset: int = 0
) -> list[EmailSync]:
    """Get email syncs for a user, ordered by most recent first."""
    result = await db.execute(
        select(EmailSync)
        .where(EmailSync.user_id == user_id)
        .order_by(EmailSync.started_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def count_by_user_id(db: AsyncSession, user_id: UUID) -> int:
    """Count total syncs for a user."""
    from sqlalchemy import func

    result = await db.execute(
        select(func.count()).select_from(EmailSync).where(EmailSync.user_id == user_id)
    )
    return result.scalar() or 0


async def create(
    db: AsyncSession,
    user_id: UUID,
    started_at: datetime | None = None,
    status: str = "pending",
) -> EmailSync:
    """Create a new email sync record."""
    sync = EmailSync(
        user_id=user_id,
        started_at=started_at or datetime.utcnow(),
        status=status,
    )
    db.add(sync)
    await db.flush()
    await db.refresh(sync)
    return sync


async def update_status(
    db: AsyncSession,
    sync: EmailSync,
    status: str,
    completed_at: datetime | None = None,
    error_message: str | None = None,
) -> EmailSync:
    """Update sync status."""
    sync.status = status
    if completed_at:
        sync.completed_at = completed_at
    if error_message is not None:
        sync.error_message = error_message
    db.add(sync)
    await db.flush()
    await db.refresh(sync)
    return sync


async def update_stats(
    db: AsyncSession,
    sync: EmailSync,
    sources_synced: int | None = None,
    emails_fetched: int | None = None,
    emails_processed: int | None = None,
    sync_metadata: dict | None = None,
) -> EmailSync:
    """Update sync statistics."""
    if sources_synced is not None:
        sync.sources_synced = sources_synced
    if emails_fetched is not None:
        sync.emails_fetched = emails_fetched
    if emails_processed is not None:
        sync.emails_processed = emails_processed
    if sync_metadata is not None:
        sync.sync_metadata = sync_metadata
    db.add(sync)
    await db.flush()
    await db.refresh(sync)
    return sync


async def complete(
    db: AsyncSession,
    sync: EmailSync,
    sources_synced: int,
    emails_fetched: int,
    emails_processed: int,
    sync_metadata: dict | None = None,
    error_message: str | None = None,
) -> EmailSync:
    """Mark a sync as completed with final stats."""
    sync.status = "failed" if error_message else "completed"
    sync.completed_at = datetime.utcnow()
    sync.sources_synced = sources_synced
    sync.emails_fetched = emails_fetched
    sync.emails_processed = emails_processed
    sync.error_message = error_message
    if sync_metadata is not None:
        sync.sync_metadata = sync_metadata
    db.add(sync)
    await db.flush()
    await db.refresh(sync)
    return sync


async def get_latest_by_user(db: AsyncSession, user_id: UUID) -> EmailSync | None:
    """Get the most recent sync for a user."""
    result = await db.execute(
        select(EmailSync)
        .where(EmailSync.user_id == user_id)
        .order_by(EmailSync.started_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_running_by_user(db: AsyncSession, user_id: UUID) -> EmailSync | None:
    """Get any currently running sync for a user."""
    result = await db.execute(
        select(EmailSync).where(
            EmailSync.user_id == user_id,
            EmailSync.status.in_(["pending", "running"]),
        )
    )
    return result.scalar_one_or_none()


async def cancel_stale_syncs(
    db: AsyncSession, user_id: UUID, stale_minutes: int = 10
) -> int:
    """Cancel any syncs that have been running for too long.

    Returns the number of syncs cancelled.
    """
    from datetime import timedelta

    from sqlalchemy import update

    cutoff = datetime.utcnow() - timedelta(minutes=stale_minutes)

    result = await db.execute(
        update(EmailSync)
        .where(
            EmailSync.user_id == user_id,
            EmailSync.status.in_(["pending", "running"]),
            EmailSync.started_at < cutoff,
        )
        .values(
            status="failed",
            completed_at=datetime.utcnow(),
            error_message="Sync timed out (cancelled as stale)",
        )
    )
    await db.flush()
    return result.rowcount


async def cancel_sync(db: AsyncSession, sync: EmailSync) -> EmailSync:
    """Force cancel a running sync."""
    sync.status = "failed"
    sync.completed_at = datetime.utcnow()
    sync.error_message = "Sync was manually cancelled"
    db.add(sync)
    await db.flush()
    await db.refresh(sync)
    return sync
