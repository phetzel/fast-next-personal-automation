"""OAuth2 client configuration."""

from authlib.integrations.starlette_client import OAuth

from app.core.config import settings

oauth = OAuth()

# Configure Google OAuth2 (for login)
oauth.register(
    name="google",
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

# Gmail OAuth scope for email access
GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"

# Configure Google OAuth2 with Gmail access (for email integration)
# This is separate from login to allow existing users to connect Gmail
oauth.register(
    name="google_gmail",
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={
        "scope": f"openid email profile {GMAIL_READONLY_SCOPE}",
        "access_type": "offline",  # Request refresh token
        "prompt": "consent",  # Force consent to get refresh token
    },
)
