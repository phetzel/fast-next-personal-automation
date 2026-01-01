"""Repository for email destination operations."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.email_destination import EmailDestination
from app.db.models.email_message_destination import EmailMessageDestination

# Email Destination operations


async def get_by_id(db: AsyncSession, destination_id: UUID) -> EmailDestination | None:
    """Get an email destination by ID."""
    return await db.get(EmailDestination, destination_id)


async def get_by_user_id(db: AsyncSession, user_id: UUID) -> list[EmailDestination]:
    """Get all email destinations for a user, ordered by priority (highest first)."""
    result = await db.execute(
        select(EmailDestination)
        .where(EmailDestination.user_id == user_id)
        .order_by(EmailDestination.priority.desc(), EmailDestination.created_at.asc())
    )
    return list(result.scalars().all())


async def get_active_by_user_id(db: AsyncSession, user_id: UUID) -> list[EmailDestination]:
    """Get all active email destinations for a user, ordered by priority."""
    result = await db.execute(
        select(EmailDestination)
        .where(EmailDestination.user_id == user_id, EmailDestination.is_active.is_(True))
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
    )
    db.add(destination)
    await db.flush()
    await db.refresh(destination)
    return destination


async def update(
    db: AsyncSession,
    destination: EmailDestination,
    name: str | None = None,
    filter_rules: dict | None = None,
    parser_name: str | None = None,
    is_active: bool | None = None,
    priority: int | None = None,
) -> EmailDestination:
    """Update an email destination."""
    if name is not None:
        destination.name = name
    if filter_rules is not None:
        destination.filter_rules = filter_rules
    if parser_name is not None:
        destination.parser_name = parser_name
    if is_active is not None:
        destination.is_active = is_active
    if priority is not None:
        destination.priority = priority
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
        from_lower = from_address.lower()
        sender_match = any(pattern.lower() in from_lower for pattern in sender_patterns)
        if not sender_match:
            return False

    # Check subject contains (if specified)
    subject_contains = rules.get("subject_contains", [])
    if subject_contains and subject:
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
    db: AsyncSession, user_id: UUID, from_address: str, subject: str | None
) -> list[EmailDestination]:
    """Find all active destinations that match an email."""
    destinations = await get_active_by_user_id(db, user_id)
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
