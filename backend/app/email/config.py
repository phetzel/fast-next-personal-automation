"""Email configuration for job alert parsing.

Defines default job board senders and parser mappings.
"""

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.email.parsers.base import EmailParser


@dataclass
class JobSenderConfig:
    """Configuration for a job board email sender."""

    domain: str  # Domain to match in from address
    parser_name: str  # Parser to use: "indeed", "linkedin", "hiringcafe", "ai"
    display_name: str  # Human-readable name


# Default job board email senders
DEFAULT_JOB_SENDERS: list[JobSenderConfig] = [
    JobSenderConfig(
        domain="indeed.com",
        parser_name="indeed",
        display_name="Indeed",
    ),
    JobSenderConfig(
        domain="hiringcafe.com",
        parser_name="hiringcafe",
        display_name="HiringCafe",
    ),
    JobSenderConfig(
        domain="linkedin.com",
        parser_name="linkedin",
        display_name="LinkedIn",
    ),
    JobSenderConfig(
        domain="glassdoor.com",
        parser_name="ai",
        display_name="Glassdoor",
    ),
    JobSenderConfig(
        domain="dice.com",
        parser_name="ai",
        display_name="Dice",
    ),
    JobSenderConfig(
        domain="ziprecruiter.com",
        parser_name="ai",
        display_name="ZipRecruiter",
    ),
]


def get_default_sender_domains() -> list[str]:
    """Get list of all default sender domains for Gmail query."""
    return [sender.domain for sender in DEFAULT_JOB_SENDERS]


def get_parser_for_sender(from_address: str) -> tuple[str, str]:
    """Get the parser name and display name for a sender email.

    Args:
        from_address: Email from address to match.

    Returns:
        Tuple of (parser_name, display_name). Returns ("ai", "Unknown") for unknown senders.
    """
    from_lower = from_address.lower()

    for sender in DEFAULT_JOB_SENDERS:
        if sender.domain in from_lower:
            return sender.parser_name, sender.display_name

    return "ai", "Unknown"


def get_parser(parser_name: str) -> "EmailParser":
    """Get a parser instance by name.

    Args:
        parser_name: Parser name ("indeed", "linkedin", "hiringcafe", "ai").

    Returns:
        EmailParser instance.
    """
    # Import here to avoid circular imports
    from app.email.parsers.ai_parser import AIEmailParser
    from app.email.parsers.hiringcafe import HiringCafeParser
    from app.email.parsers.indeed import IndeedParser
    from app.email.parsers.linkedin import LinkedInParser

    parsers = {
        "indeed": IndeedParser(),
        "linkedin": LinkedInParser(),
        "hiringcafe": HiringCafeParser(),
        "ai": AIEmailParser(),
    }

    return parsers.get(parser_name, AIEmailParser())

