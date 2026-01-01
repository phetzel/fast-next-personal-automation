"""Tests for security module."""

from datetime import timedelta

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decrypt_token,
    encrypt_token,
    get_password_hash,
    is_encrypted,
    verify_password,
    verify_token,
)


class TestPasswordHashing:
    """Tests for password hashing functions."""

    def test_hash_password(self):
        """Test password hashing."""
        password = "mysecretpassword"
        hashed = get_password_hash(password)

        assert hashed != password
        assert len(hashed) > 0
        assert hashed.startswith("$2")  # bcrypt prefix

    def test_verify_password_correct(self):
        """Test verifying correct password."""
        password = "mysecretpassword"
        hashed = get_password_hash(password)

        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Test verifying incorrect password."""
        password = "mysecretpassword"
        wrong_password = "wrongpassword"
        hashed = get_password_hash(password)

        assert verify_password(wrong_password, hashed) is False


class TestAccessToken:
    """Tests for access token functions."""

    def test_create_access_token(self):
        """Test creating access token."""
        subject = "user123"
        token = create_access_token(subject)

        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_access_token_with_expires_delta(self):
        """Test creating access token with custom expiration."""
        subject = "user123"
        expires = timedelta(hours=2)
        token = create_access_token(subject, expires_delta=expires)

        assert isinstance(token, str)
        payload = verify_token(token)
        assert payload is not None
        assert payload["sub"] == subject
        assert payload["type"] == "access"

    def test_verify_access_token(self):
        """Test verifying access token."""
        subject = "user123"
        token = create_access_token(subject)
        payload = verify_token(token)

        assert payload is not None
        assert payload["sub"] == subject
        assert payload["type"] == "access"

    def test_verify_invalid_token(self):
        """Test verifying invalid token."""
        payload = verify_token("invalid.token.here")

        assert payload is None

    def test_verify_expired_token(self):
        """Test verifying expired token."""
        subject = "user123"
        # Create token that expires immediately
        token = create_access_token(subject, expires_delta=timedelta(seconds=-1))
        payload = verify_token(token)

        assert payload is None


class TestRefreshToken:
    """Tests for refresh token functions."""

    def test_create_refresh_token(self):
        """Test creating refresh token."""
        subject = "user123"
        token = create_refresh_token(subject)

        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_refresh_token_with_expires_delta(self):
        """Test creating refresh token with custom expiration."""
        subject = "user123"
        expires = timedelta(days=7)
        token = create_refresh_token(subject, expires_delta=expires)

        assert isinstance(token, str)
        payload = verify_token(token)
        assert payload is not None
        assert payload["sub"] == subject
        assert payload["type"] == "refresh"

    def test_verify_refresh_token(self):
        """Test verifying refresh token."""
        subject = "user123"
        token = create_refresh_token(subject)
        payload = verify_token(token)

        assert payload is not None
        assert payload["sub"] == subject
        assert payload["type"] == "refresh"


class TestTokenEncryption:
    """Tests for Fernet token encryption functions."""

    def test_encrypt_token(self):
        """Test encrypting a token."""
        plaintext = "ya29.access_token_here"
        encrypted = encrypt_token(plaintext)

        assert encrypted != plaintext
        assert len(encrypted) > 0
        # Fernet tokens start with 'gAAAAA'
        assert encrypted.startswith("gAAAAA")

    def test_decrypt_token(self):
        """Test decrypting a token."""
        plaintext = "ya29.access_token_here"
        encrypted = encrypt_token(plaintext)
        decrypted = decrypt_token(encrypted)

        assert decrypted == plaintext

    def test_encrypt_decrypt_roundtrip(self):
        """Test encrypt/decrypt roundtrip preserves data."""
        tokens = [
            "short",
            "a" * 1000,  # Long token
            "special!@#$%^&*()chars",
            "unicode: 🔒 émojis",
        ]
        for token in tokens:
            encrypted = encrypt_token(token)
            decrypted = decrypt_token(encrypted)
            assert decrypted == token

    def test_is_encrypted_true(self):
        """Test is_encrypted returns True for encrypted tokens."""
        plaintext = "test_token"
        encrypted = encrypt_token(plaintext)

        assert is_encrypted(encrypted) is True

    def test_is_encrypted_false(self):
        """Test is_encrypted returns False for plaintext."""
        plaintext_values = [
            "ya29.access_token",
            "1//refresh_token",
            "not_encrypted",
            "",
        ]
        for value in plaintext_values:
            assert is_encrypted(value) is False

    def test_different_encryptions_produce_different_ciphertext(self):
        """Test that encrypting same value twice produces different ciphertext."""
        plaintext = "test_token"
        encrypted1 = encrypt_token(plaintext)
        encrypted2 = encrypt_token(plaintext)

        # Fernet uses random IV, so ciphertexts should differ
        assert encrypted1 != encrypted2
        # But both should decrypt to same plaintext
        assert decrypt_token(encrypted1) == decrypt_token(encrypted2) == plaintext
