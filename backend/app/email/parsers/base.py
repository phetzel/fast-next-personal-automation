"""Base email parser interface and common models."""

from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class ExtractedJob(BaseModel):
    """Job listing extracted from an email."""

    title: str = Field(description="Job title")
    company: str = Field(description="Company name")
    location: str | None = Field(default=None, description="Job location")
    job_url: str = Field(description="URL to the job listing")
    salary_range: str | None = Field(default=None, description="Salary range if available")
    source: str = Field(description="Source of the job (indeed, linkedin, etc.)")
    description_snippet: str | None = Field(
        default=None, description="Brief description or snippet"
    )


class EmailParser(ABC):
    """Abstract base class for email parsers.

    Each parser implements the logic to extract job listings from
    a specific job board's email format.
    """

    name: str = "base"

    @abstractmethod
    async def parse(
        self,
        subject: str,
        body_html: str,
        body_text: str,
    ) -> list[ExtractedJob]:
        """Extract job listings from email content.

        Args:
            subject: Email subject line.
            body_html: HTML body of the email.
            body_text: Plain text body of the email.

        Returns:
            List of extracted job listings.
        """
        pass

    def _clean_text(self, text: str | None) -> str:
        """Clean and normalize text content."""
        if not text:
            return ""
        # Remove extra whitespace
        return " ".join(text.split())

    def _extract_domain_from_url(self, url: str) -> str | None:
        """Extract domain from a URL for source identification.

        Returns:
            The domain (netloc) in lowercase, or None if the URL is invalid or empty.
        """
        if not url:
            return None
        try:
            from urllib.parse import urlparse

            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            return domain if domain else None
        except Exception:
            return None

