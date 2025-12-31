"""Email parsers for extracting job listings from emails."""

from app.email.parsers.ai_parser import AIEmailParser
from app.email.parsers.base import EmailParser, ExtractedJob
from app.email.parsers.hiringcafe import HiringCafeParser
from app.email.parsers.indeed import IndeedParser
from app.email.parsers.linkedin import LinkedInParser

__all__ = [
    "AIEmailParser",
    "EmailParser",
    "ExtractedJob",
    "HiringCafeParser",
    "IndeedParser",
    "LinkedInParser",
]
