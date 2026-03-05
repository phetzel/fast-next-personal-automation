"""Service for integration token management and verification."""

import secrets
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ValidationError,
)
from app.db.models.integration_token import IntegrationScope, IntegrationToken
from app.repositories import integration_token as integration_token_repo

_OPENCLAW_ALLOWED_SCOPES = {IntegrationScope.JOBS_INGEST.value}


class IntegrationTokenService:
    """Business logic for external integration tokens."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_openclaw_token(
        self,
        *,
        user_id: UUID,
        name: str,
        scopes: list[str] | None = None,
        expires_at: datetime | None = None,
    ) -> tuple[IntegrationToken, str]:
        """Create a new OpenClaw integration token and return plaintext once."""
        requested_scopes = scopes or [IntegrationScope.JOBS_INGEST.value]
        invalid_scopes = [scope for scope in requested_scopes if scope not in _OPENCLAW_ALLOWED_SCOPES]
        if invalid_scopes:
            raise ValidationError(
                message="Invalid integration token scopes requested",
                details={"invalid_scopes": invalid_scopes, "allowed_scopes": sorted(_OPENCLAW_ALLOWED_SCOPES)},
            )

        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)

        plaintext_token = f"oct_{secrets.token_urlsafe(32)}"
        token_hash = integration_token_repo.hash_token(plaintext_token)

        token = await integration_token_repo.create(
            self.db,
            user_id=user_id,
            name=name,
            token_hash=token_hash,
            scopes=requested_scopes,
            expires_at=expires_at,
        )
        return token, plaintext_token

    async def list_tokens_for_user(self, user_id: UUID) -> list[IntegrationToken]:
        """List integration tokens for a user."""
        return await integration_token_repo.list_by_user(self.db, user_id)

    async def revoke_token_for_user(self, token_id: UUID, user_id: UUID) -> IntegrationToken:
        """Revoke one user-owned token."""
        token = await integration_token_repo.get_by_id_and_user(self.db, token_id, user_id)
        if token is None:
            raise NotFoundError(message="Integration token not found")
        return await integration_token_repo.revoke(self.db, token)

    async def verify_openclaw_token(
        self,
        plaintext_token: str,
        *,
        required_scope: str = IntegrationScope.JOBS_INGEST.value,
    ) -> IntegrationToken:
        """Validate a plaintext token and required scope."""
        token_hash = integration_token_repo.hash_token(plaintext_token)
        token = await integration_token_repo.get_by_hash(self.db, token_hash)
        if token is None:
            raise AuthenticationError(message="Invalid integration token")

        if not token.is_active:
            raise AuthenticationError(message="Integration token is inactive")

        if token.expires_at is not None:
            now = datetime.now(UTC)
            expires_at = token.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=UTC)
            if expires_at <= now:
                raise AuthenticationError(message="Integration token has expired")

        if required_scope not in token.scopes:
            raise AuthorizationError(
                message="Integration token is missing required scope",
                details={"required_scope": required_scope},
            )

        await integration_token_repo.set_last_used_now(self.db, token)
        return token
