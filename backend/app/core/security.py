"""Security utilities for JWT authentication and data encryption."""

import base64
import hashlib
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any

import bcrypt
import jwt
from cryptography.fernet import Fernet

from app.core.config import settings

# === Token Encryption (Fernet) ===


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    """Get or create a Fernet instance for encryption.

    Derives a 32-byte key from SECRET_KEY using SHA-256.
    The key is cached for performance.
    """
    # Derive a Fernet-compatible key from SECRET_KEY
    # Fernet requires a 32-byte URL-safe base64-encoded key
    key_bytes = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_token(plaintext: str) -> str:
    """Encrypt a token (e.g., OAuth access/refresh token).

    Args:
        plaintext: The token string to encrypt

    Returns:
        Base64-encoded encrypted string
    """
    fernet = _get_fernet()
    encrypted = fernet.encrypt(plaintext.encode())
    return encrypted.decode()


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a token.

    Args:
        ciphertext: The encrypted token string

    Returns:
        Decrypted plaintext token

    Raises:
        cryptography.fernet.InvalidToken: If decryption fails
    """
    fernet = _get_fernet()
    decrypted = fernet.decrypt(ciphertext.encode())
    return decrypted.decode()


def is_encrypted(value: str) -> bool:
    """Check if a value appears to be Fernet-encrypted.

    Fernet tokens start with 'gAAAAA' (base64-encoded version byte).
    """
    return value.startswith("gAAAAA")


def create_access_token(
    subject: str | Any,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT access token."""
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(
    subject: str | Any,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT refresh token."""
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)

    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> dict[str, Any] | None:
    """Verify a JWT token and return payload."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return payload
    except jwt.PyJWTError:
        return None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")
