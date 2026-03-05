"""Repository for integration token operations."""

import hashlib
import hmac
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.integration_token import IntegrationToken


def hash_token(raw_token: str, *, pepper: str) -> str:
    """Hash an integration token for secure storage/lookup using a server-side pepper."""
    return hmac.new(pepper.encode("utf-8"), raw_token.encode("utf-8"), hashlib.sha256).hexdigest()


async def create(
    db: AsyncSession,
    *,
    user_id: UUID,
    name: str,
    token_hash: str,
    scopes: list[str],
    expires_at: datetime | None = None,
) -> IntegrationToken:
    """Create a new integration token record."""
    token = IntegrationToken(
        user_id=user_id,
        name=name,
        token_hash=token_hash,
        scopes=scopes,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(token)
    await db.flush()
    await db.refresh(token)
    return token


async def get_by_hash(db: AsyncSession, token_hash: str) -> IntegrationToken | None:
    """Get an integration token by hash."""
    result = await db.execute(
        select(IntegrationToken).where(IntegrationToken.token_hash == token_hash)
    )
    return result.scalar_one_or_none()


async def get_by_id_and_user(
    db: AsyncSession,
    token_id: UUID,
    user_id: UUID,
) -> IntegrationToken | None:
    """Get a token by id and owner."""
    result = await db.execute(
        select(IntegrationToken).where(
            IntegrationToken.id == token_id,
            IntegrationToken.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def list_by_user(
    db: AsyncSession,
    user_id: UUID,
) -> list[IntegrationToken]:
    """List all integration tokens for a user."""
    result = await db.execute(
        select(IntegrationToken)
        .where(IntegrationToken.user_id == user_id)
        .order_by(IntegrationToken.created_at.desc())
    )
    return list(result.scalars().all())


async def set_last_used_now(
    db: AsyncSession,
    token: IntegrationToken,
) -> IntegrationToken:
    """Update token last-used timestamp."""
    token.last_used_at = datetime.now(UTC)
    db.add(token)
    await db.flush()
    await db.refresh(token)
    return token


async def revoke(
    db: AsyncSession,
    token: IntegrationToken,
) -> IntegrationToken:
    """Disable a token so it can no longer be used."""
    token.is_active = False
    db.add(token)
    await db.flush()
    await db.refresh(token)
    return token
