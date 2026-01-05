"""HiringCafe job alert email parser.

Parses job listings from HiringCafe's job alert emails.
"""

import logging
import re

from bs4 import BeautifulSoup

from app.email.parsers.base import EmailParser, ExtractedJob

logger = logging.getLogger(__name__)


class HiringCafeParser(EmailParser):
    """Parser for HiringCafe job alert emails.

    HiringCafe emails contain curated job listings with:
    - Job title as a link
    - Company name
    - Location
    - Brief description
    """

    name = "hiringcafe"

    async def parse(
        self,
        subject: str,
        body_html: str,
        body_text: str,
    ) -> list[ExtractedJob]:
        """Extract job listings from HiringCafe email.

        Args:
            subject: Email subject line.
            body_html: HTML body of the email.
            body_text: Plain text body of the email.

        Returns:
            List of extracted job listings.
        """
        jobs: list[ExtractedJob] = []

        if not body_html:
            logger.warning("HiringCafe email has no HTML body, cannot parse")
            return jobs

        try:
            soup = BeautifulSoup(body_html, "html.parser")

            # Find job sections - HiringCafe uses various HTML structures
            job_sections = self._find_job_sections(soup)

            for section in job_sections:
                try:
                    job = self._parse_job_section(section)
                    if job:
                        jobs.append(job)
                except Exception as e:
                    logger.debug(f"Error parsing HiringCafe job section: {e}")
                    continue

            unique_jobs = self._deduplicate_jobs(jobs)
            logger.info(f"Extracted {len(unique_jobs)} jobs from HiringCafe email")
            return unique_jobs

        except Exception as e:
            logger.error(f"Error parsing HiringCafe email: {e}")
            return jobs

    def _find_job_sections(self, soup: BeautifulSoup) -> list:
        """Find job listing sections in the email."""
        job_elements = []

        # Look for job links
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            if self._is_job_url(href):
                # Get the parent container
                parent = link.find_parent(["tr", "td", "div", "table", "article"])
                if parent and parent not in job_elements:
                    job_elements.append(parent)

        return job_elements

    def _is_job_url(self, url: str) -> bool:
        """Check if URL is a job link (not unsubscribe, settings, etc.)."""
        # Skip common non-job URLs
        skip_patterns = [
            r"unsubscribe",
            r"preferences",
            r"settings",
            r"manage",
            r"mailto:",
            r"facebook\.com",
            r"twitter\.com",
            r"linkedin\.com(?!/jobs)",  # LinkedIn but not job links
        ]

        if any(re.search(pattern, url, re.I) for pattern in skip_patterns):
            return False

        # Check for likely job URL patterns
        job_patterns = [
            r"job",
            r"career",
            r"position",
            r"apply",
            r"opening",
            r"greenhouse\.io",
            r"lever\.co",
            r"workday\.com",
            r"ashbyhq\.com",
            r"boards\.greenhouse\.io",
        ]

        return any(re.search(pattern, url, re.I) for pattern in job_patterns)

    def _parse_job_section(self, section) -> ExtractedJob | None:
        """Parse a single job section element."""
        # Find the job link
        job_link = None
        job_url = None

        for link in section.find_all("a", href=True):
            href = link.get("href", "")
            if self._is_job_url(href):
                link_text = self._clean_text(link.get_text())
                # Skip if link text is too short or looks like an action
                if link_text and len(link_text) > 5:
                    skip_texts = ["apply", "view", "read more", "learn more", "click here"]
                    if not any(skip in link_text.lower() for skip in skip_texts):
                        job_link = link
                        job_url = href
                        break

        if not job_url:
            return None

        # Extract title from link text
        title = self._clean_text(job_link.get_text()) if job_link else None
        if not title:
            return None

        # Extract other details from section text
        section_text = section.get_text()
        lines = [self._clean_text(line) for line in section_text.split("\n") if line.strip()]

        # Try to find company and location
        company = self._extract_company(lines, title)
        location = self._extract_location(lines)
        snippet = self._extract_snippet(lines, title, company)

        return ExtractedJob(
            title=title,
            company=company or "Unknown Company",
            location=location,
            job_url=job_url,
            salary_range=self._extract_salary(section_text),
            source="hiringcafe",
            description_snippet=snippet,
        )

    def _extract_company(self, lines: list[str], title: str) -> str | None:
        """Extract company name from text lines."""
        for line in lines:
            # Skip the title
            if line == title:
                continue
            # Skip very short or very long lines
            if len(line) < 3 or len(line) > 100:
                continue
            # Skip lines that look like descriptions
            if len(line) > 50:
                continue
            # Skip location-like patterns
            if re.match(r"^[\w\s]+,\s*[A-Z]{2}$", line):
                continue
            # Skip common non-company text
            skip_patterns = ["remote", "hybrid", "on-site", "full-time", "part-time", "contract"]
            if any(skip in line.lower() for skip in skip_patterns):
                continue

            # This might be the company
            return line

        return None

    def _extract_location(self, lines: list[str]) -> str | None:
        """Extract location from text lines."""
        for line in lines:
            # Look for location patterns
            if re.match(r"^[\w\s]+,\s*[A-Z]{2}(?:\s+\d{5})?$", line):
                return line
            if "remote" in line.lower() and len(line) < 30:
                return line
            if "hybrid" in line.lower() and len(line) < 30:
                return line

        return None

    def _extract_salary(self, text: str) -> str | None:
        """Extract salary from text."""
        # Match salary ranges with hyphen or en-dash
        salary_patterns = [
            r"\$[\d,]+\s*[-\u2013]\s*\$[\d,]+(?:\s*/?\s*(?:year|month|hour|yr|mo|hr))?",
            r"\$[\d,]+(?:\s*/?\s*(?:year|month|hour|yr|mo|hr))",
            r"[\d,]+[kK]\s*[-\u2013]\s*[\d,]+[kK](?:\s*/?\s*(?:year|yr))?",
        ]

        for pattern in salary_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group()

        return None

    def _extract_snippet(self, lines: list[str], title: str, company: str | None) -> str | None:
        """Extract description snippet."""
        for line in lines:
            # Skip title and company
            if line in (title, company):
                continue
            # Look for longer descriptive text
            if len(line) > 50 and len(line) < 500:
                return line

        return None
