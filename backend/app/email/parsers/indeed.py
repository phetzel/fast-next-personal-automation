"""Indeed job alert email parser.

Parses job listings from Indeed's daily/weekly job alert emails.
"""

import logging
import re
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup

from app.email.parsers.base import EmailParser, ExtractedJob

logger = logging.getLogger(__name__)


class IndeedParser(EmailParser):
    """Parser for Indeed job alert emails.

    Indeed emails typically contain job cards with:
    - Job title as a link
    - Company name
    - Location
    - Salary (if available)
    - Brief description snippet
    """

    name = "indeed"

    async def parse(
        self,
        subject: str,
        body_html: str,
        body_text: str,
    ) -> list[ExtractedJob]:
        """Extract job listings from Indeed email.

        Args:
            subject: Email subject line.
            body_html: HTML body of the email.
            body_text: Plain text body of the email.

        Returns:
            List of extracted job listings.
        """
        jobs: list[ExtractedJob] = []

        if not body_html:
            logger.warning("Indeed email has no HTML body, cannot parse")
            return jobs

        try:
            soup = BeautifulSoup(body_html, "html.parser")

            # Indeed uses various structures, try common patterns
            # Pattern 1: Job cards with specific class patterns
            job_cards = soup.find_all("tr", class_=re.compile(r"job|result", re.I))

            if not job_cards:
                # Pattern 2: Table-based layout
                job_cards = soup.find_all("table", class_=re.compile(r"job", re.I))

            if not job_cards:
                # Pattern 3: Div-based layout (newer emails)
                job_cards = soup.find_all("div", class_=re.compile(r"job.*card", re.I))

            if not job_cards:
                # Pattern 4: Look for links that contain job URLs
                job_cards = self._find_job_links(soup)

            for card in job_cards:
                try:
                    job = self._parse_job_card(card)
                    if job:
                        jobs.append(job)
                except Exception as e:
                    logger.debug(f"Error parsing Indeed job card: {e}")
                    continue

            # Deduplicate by URL
            seen_urls = set()
            unique_jobs = []
            for job in jobs:
                if job.job_url not in seen_urls:
                    seen_urls.add(job.job_url)
                    unique_jobs.append(job)

            logger.info(f"Extracted {len(unique_jobs)} jobs from Indeed email")
            return unique_jobs

        except Exception as e:
            logger.error(f"Error parsing Indeed email: {e}")
            return jobs

    def _find_job_links(self, soup: BeautifulSoup) -> list:
        """Find job links when standard patterns don't match."""
        job_elements = []

        # Find all links that look like Indeed job URLs
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            if self._is_indeed_job_url(href):
                # Get the parent container
                parent = link.find_parent(["tr", "td", "div", "table"])
                if parent and parent not in job_elements:
                    job_elements.append(parent)

        return job_elements

    def _is_indeed_job_url(self, url: str) -> bool:
        """Check if URL is an Indeed job link."""
        patterns = [
            r"indeed\.com/viewjob",
            r"indeed\.com/rc/clk",
            r"indeed\.com/job/",
            r"click\.indeed\.com",
        ]
        return any(re.search(pattern, url, re.I) for pattern in patterns)

    def _parse_job_card(self, card) -> ExtractedJob | None:
        """Parse a single job card element."""
        # Find the job link
        job_link = None
        job_url = None

        for link in card.find_all("a", href=True):
            href = link.get("href", "")
            if self._is_indeed_job_url(href):
                job_link = link
                job_url = self._clean_indeed_url(href)
                break

        if not job_url:
            return None

        # Extract title from link text
        title = self._clean_text(job_link.get_text()) if job_link else None
        if not title:
            return None

        # Try to find company name
        company = self._extract_company(card)
        if not company:
            company = "Unknown Company"

        # Try to find location
        location = self._extract_location(card)

        # Try to find salary
        salary = self._extract_salary(card)

        # Get description snippet
        snippet = self._extract_snippet(card)

        return ExtractedJob(
            title=title,
            company=company,
            location=location,
            job_url=job_url,
            salary_range=salary,
            source="indeed",
            description_snippet=snippet,
        )

    def _clean_indeed_url(self, url: str) -> str:
        """Clean and normalize Indeed job URL."""
        # Try to extract the actual job URL from tracking URLs
        try:
            parsed = urlparse(url)
            if "click.indeed.com" in parsed.netloc:
                # Extract destination URL from query params
                params = parse_qs(parsed.query)
                if "url" in params:
                    return params["url"][0]

            # Return cleaned URL
            return url.split("?")[0] if "?" in url else url
        except Exception:
            return url

    def _extract_company(self, card) -> str | None:
        """Extract company name from job card."""
        # Try various class patterns
        patterns = [
            {"class_": re.compile(r"company", re.I)},
            {"class_": re.compile(r"employer", re.I)},
            {"data-testid": "company-name"},
        ]

        for pattern in patterns:
            elem = card.find(["span", "div", "a"], **pattern)
            if elem:
                text = self._clean_text(elem.get_text())
                if text and len(text) > 1:
                    return text

        return None

    def _extract_location(self, card) -> str | None:
        """Extract location from job card."""
        patterns = [
            {"class_": re.compile(r"location", re.I)},
            {"data-testid": "location"},
        ]

        for pattern in patterns:
            elem = card.find(["span", "div"], **pattern)
            if elem:
                text = self._clean_text(elem.get_text())
                if text:
                    return text

        return None

    def _extract_salary(self, card) -> str | None:
        """Extract salary from job card."""
        # Look for salary patterns in text
        text = card.get_text()

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

    def _extract_snippet(self, card) -> str | None:
        """Extract description snippet from job card."""
        patterns = [
            {"class_": re.compile(r"description|snippet|summary", re.I)},
        ]

        for pattern in patterns:
            elem = card.find(["span", "div", "p"], **pattern)
            if elem:
                text = self._clean_text(elem.get_text())
                if text and len(text) > 20:
                    return text[:500]  # Limit length

        return None

