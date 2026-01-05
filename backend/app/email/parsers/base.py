"""Base email parser interface and common models."""

from abc import ABC, abstractmethod

# Re-export ExtractedJob from unified job_data module for backward compatibility
from app.schemas.job_data import ExtractedJob


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

    def _deduplicate_jobs(self, jobs: list[ExtractedJob]) -> list[ExtractedJob]:
        """Deduplicate jobs by URL, preserving order.

        Args:
            jobs: List of extracted jobs that may contain duplicates.

        Returns:
            List of unique jobs based on job_url.
        """
        seen_urls: set[str] = set()
        unique_jobs: list[ExtractedJob] = []
        for job in jobs:
            if job.job_url not in seen_urls:
                seen_urls.add(job.job_url)
                unique_jobs.append(job)
        return unique_jobs

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
