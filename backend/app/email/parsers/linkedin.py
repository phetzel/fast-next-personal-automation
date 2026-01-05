"""LinkedIn job alert email parser.

Parses job listings from LinkedIn's job alert emails.
"""

import logging
import re

from bs4 import BeautifulSoup

from app.email.parsers.base import EmailParser, ExtractedJob

logger = logging.getLogger(__name__)


class LinkedInParser(EmailParser):
    """Parser for LinkedIn job alert emails.

    LinkedIn emails typically contain job cards with:
    - Job title as a link
    - Company name and logo
    - Location
    - Posted time
    """

    name = "linkedin"

    async def parse(
        self,
        subject: str,
        body_html: str,
        body_text: str,
    ) -> list[ExtractedJob]:
        """Extract job listings from LinkedIn email.

        Args:
            subject: Email subject line.
            body_html: HTML body of the email.
            body_text: Plain text body of the email.

        Returns:
            List of extracted job listings.
        """
        jobs: list[ExtractedJob] = []

        if not body_html:
            logger.warning("LinkedIn email has no HTML body, cannot parse")
            return jobs

        try:
            soup = BeautifulSoup(body_html, "html.parser")

            # LinkedIn uses table-based layouts for emails
            # Look for job sections
            job_sections = self._find_job_sections(soup)

            for section in job_sections:
                try:
                    job = self._parse_job_section(section)
                    if job:
                        jobs.append(job)
                except Exception as e:
                    logger.debug(f"Error parsing LinkedIn job section: {e}")
                    continue

            unique_jobs = self._deduplicate_jobs(jobs)
            logger.info(f"Extracted {len(unique_jobs)} jobs from LinkedIn email")
            return unique_jobs

        except Exception as e:
            logger.error(f"Error parsing LinkedIn email: {e}")
            return jobs

    def _find_job_sections(self, soup: BeautifulSoup) -> list:
        """Find job listing sections in the email."""
        job_elements = []

        # Find all links that look like LinkedIn job URLs
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            if self._is_linkedin_job_url(href):
                # Get the parent container (usually a table row or cell)
                parent = link.find_parent(["tr", "td", "div", "table"])
                if parent and parent not in job_elements:
                    job_elements.append(parent)

        return job_elements

    def _is_linkedin_job_url(self, url: str) -> bool:
        """Check if URL is a LinkedIn job link."""
        patterns = [
            r"linkedin\.com/jobs/view/",
            r"linkedin\.com/comm/jobs/view/",
            r"lnkd\.in/",
        ]
        return any(re.search(pattern, url, re.I) for pattern in patterns)

    def _parse_job_section(self, section) -> ExtractedJob | None:
        """Parse a single job section element."""
        # Find the job link
        job_link = None
        job_url = None

        for link in section.find_all("a", href=True):
            href = link.get("href", "")
            if self._is_linkedin_job_url(href):
                job_link = link
                job_url = self._clean_linkedin_url(href)
                break

        if not job_url:
            return None

        # Extract title from link text
        title = self._clean_text(job_link.get_text()) if job_link else None
        if not title or len(title) < 3:
            return None

        # Skip if title looks like a button or action text
        skip_patterns = ["view job", "apply now", "see more", "view all"]
        if any(pattern in title.lower() for pattern in skip_patterns):
            return None

        # Try to find company name
        company = self._extract_company(section)
        if not company:
            company = "Unknown Company"

        # Try to find location
        location = self._extract_location(section)

        return ExtractedJob(
            title=title,
            company=company,
            location=location,
            job_url=job_url,
            salary_range=None,  # LinkedIn rarely includes salary in emails
            source="linkedin",
            description_snippet=None,
        )

    def _clean_linkedin_url(self, url: str) -> str:
        """Clean and normalize LinkedIn job URL."""
        try:
            # Extract job ID if present
            if "/jobs/view/" in url:
                # Extract just the job view URL
                match = re.search(r"(linkedin\.com/(?:comm/)?jobs/view/\d+)", url)
                if match:
                    return f"https://www.{match.group(1)}"

            return url
        except Exception:
            return url

    def _extract_company(self, section) -> str | None:
        """Extract company name from job section."""
        # LinkedIn often puts company name in a separate element after the title
        text = section.get_text()
        lines = [self._clean_text(line) for line in text.split("\n") if line.strip()]

        # Company is usually the second meaningful line after the title
        for i, line in enumerate(lines):
            # Skip short lines and action text
            if len(line) < 3:
                continue
            if any(
                skip in line.lower() for skip in ["view job", "apply", "see more", "posted", "ago"]
            ):
                continue

            # After finding the title, the next good line is likely company
            # Check if it looks like a company name (not a location)
            is_not_location = not re.match(r"^[\w\s]+,\s*[A-Z]{2}$", line)
            if i > 0 and len(line) > 2 and not line.startswith("$") and is_not_location:
                return line

        return None

    def _extract_location(self, section) -> str | None:
        """Extract location from job section."""
        text = section.get_text()

        # Look for location patterns
        patterns = [
            r"([A-Za-z\s]+,\s*[A-Z]{2}(?:\s+\d{5})?)",  # City, ST or City, ST 12345
            r"([A-Za-z\s]+,\s*[A-Za-z\s]+,\s*[A-Za-z\s]+)",  # City, State, Country
            r"(Remote|Hybrid|On-site)",
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                location = self._clean_text(match.group(1))
                if location and len(location) > 2:
                    return location

        return None
