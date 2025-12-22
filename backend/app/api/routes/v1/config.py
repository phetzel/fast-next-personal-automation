"""Public configuration routes."""

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/public")
async def get_public_config():
    """Get public configuration settings.

    These settings are safe to expose to the frontend.
    """
    return {
        "registration_enabled": settings.REGISTRATION_ENABLED,
    }

