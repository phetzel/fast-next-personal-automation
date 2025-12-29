"""Email integration module for parsing job alert emails."""

from app.email.config import DEFAULT_JOB_SENDERS, get_parser_for_sender
from app.email.parsers.base import EmailParser, ExtractedJob

__all__ = [
    "DEFAULT_JOB_SENDERS",
    "EmailParser",
    "ExtractedJob",
    "get_parser_for_sender",
]

