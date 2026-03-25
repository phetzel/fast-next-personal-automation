"""Helpers for normalizing email sender identities."""

from email.utils import parseaddr


def should_archive_recommend(
    bucket: str | None,
    confidence: float | None,
    actionability_score: float | None,
    is_vip: bool,
) -> bool:
    """Determine whether a message should surface as a read-only archive recommendation."""
    if is_vip or bucket not in {"newsletter", "notifications", "done"}:
        return False
    if confidence is None or confidence < 0.9:
        return False
    if actionability_score is None:
        return bucket in {"newsletter", "done"}
    return actionability_score <= 0.3


def normalize_sender(from_address: str | None) -> str | None:
    """Return a lowercase email address when possible, else the normalized raw sender."""
    if not from_address:
        return None

    _, email_address = parseaddr(from_address)
    normalized = (email_address or from_address).strip().lower()
    return normalized or None


def sender_domain(from_address: str | None) -> str | None:
    """Return the sender domain for an email/header value when available."""
    normalized = normalize_sender(from_address)
    if normalized is None:
        return None
    if "@" not in normalized:
        return normalized
    return normalized.split("@", 1)[1]


def sender_matches_pattern(from_address: str | None, pattern: str | None) -> bool:
    """Match a sender against an exact email address or domain/subdomain pattern."""
    normalized_sender = normalize_sender(from_address)
    normalized_pattern = normalize_sender(pattern)
    if normalized_sender is None or normalized_pattern is None:
        return False

    if "@" in normalized_pattern:
        return normalized_sender == normalized_pattern

    domain = sender_domain(normalized_sender)
    if domain is None:
        return normalized_sender == normalized_pattern

    return domain == normalized_pattern or domain.endswith(f".{normalized_pattern}")
