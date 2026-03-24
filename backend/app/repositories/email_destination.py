"""Repository for email destination operations."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.email_destination import EmailDestination
from app.db.models.email_message_destination import EmailMessageDestination
from app.email.utils import sender_matches_pattern

_UNSET = object()

# Email Destination operations


async def get_by_id(db: AsyncSession, destination_id: UUID) -> EmailDestination | None:
    """Get an email destination by ID."""
    return await db.get(EmailDestination, destination_id)


async def get_by_user_id(
    db: AsyncSession,
    user_id: UUID,
    *,
    destination_type: str | None = None,
) -> list[EmailDestination]:
    """Get all email destinations for a user, ordered by priority (highest first)."""
    conditions = [EmailDestination.user_id == user_id]
    if destination_type is not None:
        conditions.append(EmailDestination.destination_type == destination_type)

    result = await db.execute(
        select(EmailDestination)
        .where(*conditions)
        .order_by(EmailDestination.priority.desc(), EmailDestination.created_at.asc())
    )
    return list(result.scalars().all())


async def get_active_by_user_id(
    db: AsyncSession,
    user_id: UUID,
    *,
    destination_type: str | None = None,
) -> list[EmailDestination]:
    """Get all active email destinations for a user, ordered by priority."""
    conditions = [
        EmailDestination.user_id == user_id,
        EmailDestination.is_active.is_(True),
    ]
    if destination_type is not None:
        conditions.append(EmailDestination.destination_type == destination_type)

    result = await db.execute(
        select(EmailDestination)
        .where(*conditions)
        .order_by(EmailDestination.priority.desc(), EmailDestination.created_at.asc())
    )
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
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
    destination = EmailDestination(
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
    db.add(destination)
    await db.flush()
    await db.refresh(destination)
    return destination


async def update(
    db: AsyncSession,
    destination: EmailDestination,
    name: str | None | object = _UNSET,
    filter_rules: dict | None | object = _UNSET,
    parser_name: str | None | object = _UNSET,
    is_active: bool | None | object = _UNSET,
    priority: int | None | object = _UNSET,
    always_keep: bool | None | object = _UNSET,
    queue_unsubscribe: bool | None | object = _UNSET,
    suggest_archive: bool | None | object = _UNSET,
    bucket_override: str | None | object = _UNSET,
) -> EmailDestination:
    """Update an email destination."""
    if name is not _UNSET:
        destination.name = name
    if filter_rules is not _UNSET:
        destination.filter_rules = filter_rules
    if parser_name is not _UNSET:
        destination.parser_name = parser_name
    if is_active is not _UNSET:
        destination.is_active = is_active
    if priority is not _UNSET:
        destination.priority = priority
    if always_keep is not _UNSET:
        destination.always_keep = always_keep
    if queue_unsubscribe is not _UNSET:
        destination.queue_unsubscribe = queue_unsubscribe
    if suggest_archive is not _UNSET:
        destination.suggest_archive = suggest_archive
    if bucket_override is not _UNSET:
        destination.bucket_override = bucket_override
    db.add(destination)
    await db.flush()
    await db.refresh(destination)
    return destination


async def delete(db: AsyncSession, destination: EmailDestination) -> None:
    """Delete an email destination."""
    await db.delete(destination)
    await db.flush()


def matches_email(destination: EmailDestination, from_address: str, subject: str | None) -> bool:
    """Check if an email matches this destination's filter rules.

    Args:
        destination: The destination with filter rules
        from_address: The sender's email address
        subject: The email subject (may be None)

    Returns:
        True if the email matches the destination's rules
    """
    rules = destination.filter_rules or {}

    # Check sender patterns
    sender_patterns = rules.get("sender_patterns", [])
    if sender_patterns:
        sender_match = any(
            sender_matches_pattern(from_address, pattern) for pattern in sender_patterns
        )
        if not sender_match:
            return False

    # Check subject contains (if specified)
    subject_contains = rules.get("subject_contains", [])
    if subject_contains:
        if not subject:
            return False
        subject_lower = subject.lower()
        contains_match = any(term.lower() in subject_lower for term in subject_contains)
        if not contains_match:
            return False

    # Check subject not contains (if specified)
    subject_not_contains = rules.get("subject_not_contains", [])
    if subject_not_contains and subject:
        subject_lower = subject.lower()
        for term in subject_not_contains:
            if term.lower() in subject_lower:
                return False

    # If we have no rules, match everything (default behavior)
    if not sender_patterns and not subject_contains:
        return True

    return True


async def find_matching_destinations(
    db: AsyncSession,
    user_id: UUID,
    from_address: str,
    subject: str | None,
    *,
    destination_type: str | None = None,
) -> list[EmailDestination]:
    """Find all active destinations that match an email."""
    destinations = await get_active_by_user_id(db, user_id, destination_type=destination_type)
    return [d for d in destinations if matches_email(d, from_address, subject)]


# Email Message Destination operations


async def create_message_destination(
    db: AsyncSession,
    message_id: UUID,
    destination_id: UUID,
    processed_at: datetime | None = None,
    parser_used: str | None = None,
    items_extracted: int = 0,
    processing_error: str | None = None,
    created_item_ids: list | None = None,
) -> EmailMessageDestination:
    """Create a record of a message being processed by a destination."""
    record = EmailMessageDestination(
        message_id=message_id,
        destination_id=destination_id,
        processed_at=processed_at or datetime.utcnow(),
        parser_used=parser_used,
        items_extracted=items_extracted,
        processing_error=processing_error,
        created_item_ids=created_item_ids,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


async def get_message_destinations(
    db: AsyncSession, message_id: UUID
) -> list[EmailMessageDestination]:
    """Get all destination processing records for a message."""
    result = await db.execute(
        select(EmailMessageDestination)
        .where(EmailMessageDestination.message_id == message_id)
        .order_by(EmailMessageDestination.processed_at.desc())
    )
    return list(result.scalars().all())


async def get_destination_stats(db: AsyncSession, destination_id: UUID) -> dict:
    """Get statistics for a destination."""
    result = await db.execute(
        select(EmailMessageDestination).where(
            EmailMessageDestination.destination_id == destination_id
        )
    )
    records = list(result.scalars().all())

    total_processed = len(records)
    total_items = sum(r.items_extracted for r in records)
    successful = sum(1 for r in records if r.processing_error is None)
    failed = total_processed - successful

    return {
        "total_processed": total_processed,
        "total_items_extracted": total_items,
        "successful": successful,
        "failed": failed,
    }
