"""Email sources API routes for Gmail integration."""

from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.api.deps import CurrentUser, DBSession
from app.core.config import settings
from app.core.oauth import oauth
from app.email.config import DEFAULT_JOB_SENDERS
from app.pipelines.action_base import PipelineContext, PipelineSource
from app.pipelines.registry import execute_pipeline
from app.repositories import email_source_repo
from app.schemas.email_source import (
    DefaultSenderInfo,
    EmailConfigResponse,
    EmailMessageResponse,
    EmailSourceResponse,
    EmailSourceStats,
    EmailSourceUpdate,
    EmailSourceWithStats,
    EmailSyncOutput,
)
from app.services.email import EmailService

router = APIRouter()

# Frontend URL for OAuth callback redirects
FRONTEND_URL = settings.FRONTEND_URL


@router.get("/sources", response_model=list[EmailSourceResponse])
async def list_email_sources(
    db: DBSession,
    current_user: CurrentUser,
):
    """List all connected email accounts for the current user."""
    sources = await email_source_repo.get_by_user_id(db, current_user.id)
    return sources


@router.get("/sources/{source_id}", response_model=EmailSourceWithStats)
async def get_email_source(
    source_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get a specific email source with statistics."""
    source = await email_source_repo.get_by_id(db, source_id)
    if source is None or source.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email source not found")

    # Get stats
    stats_data = await email_source_repo.get_message_stats(db, source_id)
    stats = EmailSourceStats(**stats_data)

    return EmailSourceWithStats(
        id=source.id,
        email_address=source.email_address,
        provider=source.provider,
        is_active=source.is_active,
        last_sync_at=source.last_sync_at,
        last_sync_error=source.last_sync_error,
        custom_senders=source.custom_senders,
        created_at=source.created_at,
        updated_at=source.updated_at,
        stats=stats,
    )


@router.get("/gmail/connect")
async def connect_gmail(
    request: Request,
    token: str = Query(..., description="JWT access token"),
) -> RedirectResponse:
    """Start Gmail OAuth flow to connect email account.

    Security note: JWT is passed as query param because OAuth flows require browser
    redirects, and HTTP headers cannot be set in redirect URLs. Mitigations:
    - Token is validated immediately and not stored
    - User ID is transferred to server-side session after validation
    - The token only grants permission to initiate this specific OAuth flow
    - JWTs are short-lived (default 30 minutes)

    Redirects user to Google consent screen with Gmail read permissions.
    """
    from app.core.security import verify_token

    # Verify the token from query param
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    redirect_uri = settings.GOOGLE_GMAIL_REDIRECT_URI

    # Store user ID in session for callback
    request.session["gmail_connect_user_id"] = user_id

    return await oauth.google_gmail.authorize_redirect(request, redirect_uri)


@router.get("/gmail/callback")
async def gmail_callback(request: Request, db: DBSession):
    """Handle Gmail OAuth callback.

    Creates or updates EmailSource with the OAuth tokens.
    Redirects to frontend settings page.
    """
    try:
        # Get user ID from session
        user_id_str = request.session.get("gmail_connect_user_id")
        if not user_id_str:
            params = urlencode({"error": "Session expired. Please try again."})
            return RedirectResponse(url=f"{FRONTEND_URL}/settings/email?{params}")

        user_id = UUID(user_id_str)

        # Exchange code for tokens
        token = await oauth.google_gmail.authorize_access_token(request)

        # Get user info to get email address
        user_info = token.get("userinfo")
        if not user_info:
            params = urlencode({"error": "Failed to get email info from Google"})
            return RedirectResponse(url=f"{FRONTEND_URL}/settings/email?{params}")

        email_address = user_info.get("email")
        access_token = token.get("access_token")
        refresh_token = token.get("refresh_token")

        if not access_token or not refresh_token:
            params = urlencode({"error": "Failed to get OAuth tokens"})
            return RedirectResponse(url=f"{FRONTEND_URL}/settings/email?{params}")

        # Calculate token expiry
        expires_in = token.get("expires_in", 3600)
        token_expiry = datetime.now(UTC) + timedelta(seconds=expires_in)

        # Check if this email is already connected
        existing = await email_source_repo.get_by_email_and_user(db, email_address, user_id)

        # Create email service for default destination seeding
        email_service = EmailService(db)

        if existing:
            # Update existing source with new tokens
            await email_source_repo.update_tokens(db, existing, access_token, token_expiry)
            existing.refresh_token = refresh_token
            existing.is_active = True
            await db.commit()
        else:
            # Create new source
            await email_source_repo.create(
                db,
                user_id=user_id,
                email_address=email_address,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expiry=token_expiry,
            )

            # Ensure user has a default Job Alerts destination
            await email_service.ensure_default_destination(user_id)

            await db.commit()

        # Clear session
        request.session.pop("gmail_connect_user_id", None)

        # Redirect to frontend with success
        params = urlencode({"success": "Gmail connected successfully"})
        return RedirectResponse(url=f"{FRONTEND_URL}/settings/email?{params}")

    except Exception as e:
        # Log full error internally but show generic message to user
        import logging

        logger = logging.getLogger(__name__)
        logger.exception(f"Gmail OAuth callback error: {e}")
        params = urlencode(
            {"error": "An error occurred connecting your Gmail account. Please try again."}
        )
        return RedirectResponse(url=f"{FRONTEND_URL}/settings/email?{params}")


@router.post("/sources/{source_id}/sync", response_model=EmailSyncOutput)
async def sync_email_source(
    source_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
    force_full_sync: bool = Query(default=False),
):
    """Trigger a manual sync for an email source."""
    source = await email_source_repo.get_by_id(db, source_id)
    if source is None or source.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email source not found")

    if not source.is_active:
        raise HTTPException(status_code=400, detail="Email source is disabled")

    # Execute sync pipeline
    context = PipelineContext(
        user_id=current_user.id,
        source=PipelineSource.API,
    )

    result = await execute_pipeline(
        "email_sync_jobs",
        {"source_id": str(source_id), "force_full_sync": force_full_sync},
        context,
        db=db,
    )

    await db.commit()

    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)

    return result.output


@router.patch("/sources/{source_id}", response_model=EmailSourceResponse)
async def update_email_source(
    source_id: UUID,
    update_data: EmailSourceUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Update email source settings."""
    source = await email_source_repo.get_by_id(db, source_id)
    if source is None or source.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email source not found")

    if update_data.is_active is not None:
        await email_source_repo.set_active(db, source, update_data.is_active)

    if update_data.custom_senders is not None:
        await email_source_repo.update_custom_senders(db, source, update_data.custom_senders)

    await db.commit()
    await db.refresh(source)

    return source


@router.delete("/sources/{source_id}")
async def disconnect_email_source(
    source_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """Disconnect an email account."""
    source = await email_source_repo.get_by_id(db, source_id)
    if source is None or source.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email source not found")

    await email_source_repo.delete(db, source)
    await db.commit()

    return {"message": "Email source disconnected successfully"}


@router.get("/sources/{source_id}/messages", response_model=list[EmailMessageResponse])
async def list_email_messages(
    source_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
    limit: int = Query(default=50, le=200),
):
    """List recent processed messages for an email source."""
    source = await email_source_repo.get_by_id(db, source_id)
    if source is None or source.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Email source not found")

    messages = await email_source_repo.get_messages_by_source(db, source_id, limit=limit)
    return messages


@router.get("/config", response_model=EmailConfigResponse)
async def get_email_config():
    """Get email configuration info (default senders, sync interval)."""
    default_senders = [
        DefaultSenderInfo(
            domain=sender.domain,
            display_name=sender.display_name,
            parser_name=sender.parser_name,
        )
        for sender in DEFAULT_JOB_SENDERS
    ]

    return EmailConfigResponse(
        default_senders=default_senders,
        sync_interval_minutes=settings.EMAIL_SYNC_INTERVAL_MINUTES,
    )
