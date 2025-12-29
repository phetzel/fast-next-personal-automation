"""External service clients.

This module contains thin wrappers around external services like Redis and Gmail.
"""

from app.clients.gmail import EmailContent, GmailClient
from app.clients.redis import RedisClient

__all__ = [
    "EmailContent",
    "GmailClient",
    "RedisClient",
]
