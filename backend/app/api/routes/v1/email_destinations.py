"""Email destinations API routes for managing routing rules."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession, EmailSvc
from app.repositories import email_destination_repo
from app.schemas.email_destination import (
    EmailDestinationCreate,
    EmailDestinationResponse,
    EmailDestinationStats,
    EmailDestinationUpdate,
    EmailDestinationWithStats,
)

router = APIRouter()


@router.get("", response_model=list[EmailDestinationResponse])
async def list_destinations(
    current_user: CurrentUser,
    email_service: EmailSvc,
    destination_type: str | None = Query(default=None),
):
    """List all email destinations for the current user."""
    destinations = await email_service.list_destinations(
        current_user.id,
        destination_type=destination_type,
    )
    return [EmailDestinationResponse.model_validate(d) for d in destinations]


@router.post("", response_model=EmailDestinationResponse)
async def create_destination(
    destination_data: EmailDestinationCreate,
    db: DBSession,
    current_user: CurrentUser,
    email_service: EmailSvc,
):
    """Create a new email destination with routing rules."""
    filter_rules = None
    if destination_data.filter_rules:
        filter_rules = destination_data.filter_rules.model_dump()

    destination = await email_service.create_destination(
        user_id=current_user.id,
        name=destination_data.name,
        destination_type=destination_data.destination_type,
        filter_rules=filter_rules,
        parser_name=destination_data.parser_name,
        is_active=destination_data.is_active,
        priority=destination_data.priority,
        always_keep=destination_data.always_keep,
        queue_unsubscribe=destination_data.queue_unsubscribe,
        suggest_archive=destination_data.suggest_archive,
        bucket_override=destination_data.bucket_override,
    )
    await db.commit()
    return EmailDestinationResponse.model_validate(destination)


@router.get("/{destination_id}", response_model=EmailDestinationWithStats)
async def get_destination(
    destination_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
    email_service: EmailSvc,
):
    """Get a specific email destination with statistics."""
    destination = await email_service.get_destination_by_id(destination_id, current_user.id)
    stats_data = await email_destination_repo.get_destination_stats(db, destination_id)

    return EmailDestinationWithStats(
        id=destination.id,
        user_id=destination.user_id,
        name=destination.name,
        destination_type=destination.destination_type,
        filter_rules=destination.filter_rules,
        parser_name=destination.parser_name,
        is_active=destination.is_active,
        priority=destination.priority,
        always_keep=destination.always_keep,
        queue_unsubscribe=destination.queue_unsubscribe,
        suggest_archive=destination.suggest_archive,
        bucket_override=destination.bucket_override,
        created_at=destination.created_at,
        updated_at=destination.updated_at,
        stats=EmailDestinationStats(**stats_data),
    )


@router.patch("/{destination_id}", response_model=EmailDestinationResponse)
async def update_destination(
    destination_id: UUID,
    update_data: EmailDestinationUpdate,
    db: DBSession,
    current_user: CurrentUser,
    email_service: EmailSvc,
):
    """Update an email destination's settings."""
    update_kwargs: dict[str, Any] = {}

    for field_name in update_data.model_fields_set:
        if field_name == "filter_rules":
            filter_rules = update_data.filter_rules
            update_kwargs["filter_rules"] = filter_rules.model_dump() if filter_rules else None
        else:
            update_kwargs[field_name] = getattr(update_data, field_name)

    destination = await email_service.update_destination(
        destination_id, current_user.id, **update_kwargs
    )
    await db.commit()
    return EmailDestinationResponse.model_validate(destination)


@router.delete("/{destination_id}")
async def delete_destination(
    destination_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
    email_service: EmailSvc,
):
    """Delete an email destination."""
    await email_service.delete_destination(destination_id, current_user.id)
    await db.commit()
    return {"message": "Destination deleted successfully"}
