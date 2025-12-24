"""Job scraper implementations.

Pluggable scrapers for fetching job listings from various sources.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class SearchConfig(BaseModel):
    """Configuration for a job search query."""

    terms: list[str] = Field(
        default=["Python Developer"], description="Search terms to query"
    )
    locations: list[str] = Field(
        default=["Remote"], description="Locations to search"
    )
    is_remote: bool = Field(default=True, description="Filter for remote jobs only")
    hours_old: int = Field(default=24, description="Max age of postings in hours")
    results_per_term: int = Field(default=5, description="Results per search term")


class ScrapedJob(BaseModel):
    """A job listing scraped from a job board."""

    title: str
    company: str
    location: str | None = None
    description: str | None = None
    job_url: str
    salary_range: str | None = None
    date_posted: datetime | None = None
    source: str | None = None  # linkedin, indeed, glassdoor, etc.


class JobScraperBase(ABC):
    """Abstract base class for job scrapers."""

    @abstractmethod
    async def search(self, config: SearchConfig) -> list[ScrapedJob]:
        """Search for jobs matching the config.

        Args:
            config: Search parameters

        Returns:
            List of scraped job listings
        """
        pass


class MockScraper(JobScraperBase):
    """Mock scraper for testing and development."""

    async def search(self, config: SearchConfig) -> list[ScrapedJob]:
        """Return mock job data for testing."""
        logger.info(f"MockScraper: Searching with config {config}")

        mock_jobs = []
        for i, term in enumerate(config.terms):
            for j, location in enumerate(config.locations):
                mock_jobs.append(
                    ScrapedJob(
                        title=f"Senior {term}",
                        company=f"Tech Company {i + 1}",
                        location=location,
                        description=f"We're looking for an experienced {term} to join our team. "
                        f"You'll work on exciting projects using Python, FastAPI, and modern technologies. "
                        f"Requirements: 5+ years experience, strong problem-solving skills.",
                        job_url=f"https://example.com/jobs/{i}-{j}-{term.lower().replace(' ', '-')}",
                        salary_range="$120,000 - $180,000",
                        date_posted=datetime.now(),
                        source="mock",
                    )
                )

        # Limit to configured results
        max_results = config.results_per_term * len(config.terms)
        return mock_jobs[:max_results]


class JobSpyScraper(JobScraperBase):
    """Scraper using python-jobspy library.

    Scrapes LinkedIn, Indeed, and Glassdoor for job listings.
    Requires python-jobspy to be installed.
    """

    def __init__(self):
        self._scrape_jobs = None

    def _get_scrape_jobs(self):
        """Lazy import of jobspy to handle optional dependency."""
        if self._scrape_jobs is None:
            try:
                from jobspy import scrape_jobs

                self._scrape_jobs = scrape_jobs
            except ImportError as err:
                logger.warning(
                    "python-jobspy not installed. Install with: pip install python-jobspy"
                )
                raise ImportError(
                    "python-jobspy is required for JobSpyScraper. "
                    "Install with: pip install python-jobspy"
                ) from err
        return self._scrape_jobs

    async def search(self, config: SearchConfig) -> list[ScrapedJob]:
        """Search for jobs using python-jobspy.

        Runs the synchronous jobspy scraper in a thread pool.
        """
        scrape_jobs = self._get_scrape_jobs()

        all_jobs: list[ScrapedJob] = []

        for term in config.terms:
            for location in config.locations:
                logger.info(f"JobSpyScraper: Searching '{term}' in '{location}'")

                try:
                    # Run synchronous scraper in thread pool
                    jobs_df = await asyncio.to_thread(
                        scrape_jobs,
                        site_name=["linkedin", "indeed", "glassdoor"],
                        search_term=term,
                        location=location,
                        is_remote=config.is_remote,
                        hours_old=config.hours_old,
                        results_wanted=config.results_per_term,
                        country_indeed="usa",
                    )

                    # Convert DataFrame rows to ScrapedJob objects
                    for _, row in jobs_df.iterrows():
                        try:
                            # Parse date if available
                            date_posted = None
                            if row.get("date_posted") and str(row.get("date_posted")) != "NaT":
                                try:
                                    date_posted = row.get("date_posted")
                                    if hasattr(date_posted, "to_pydatetime"):
                                        date_posted = date_posted.to_pydatetime()
                                except Exception:
                                    # Date parsing failed, leave date_posted as None
                                    pass

                            # Build salary range
                            salary_range = None
                            min_amt = row.get("min_amount")
                            max_amt = row.get("max_amount")
                            if min_amt and str(min_amt) != "nan":
                                if max_amt and str(max_amt) != "nan":
                                    salary_range = f"${int(min_amt):,} - ${int(max_amt):,}"
                                else:
                                    salary_range = f"${int(min_amt):,}+"

                            job = ScrapedJob(
                                title=str(row.get("title", "Unknown")),
                                company=str(row.get("company", "Unknown")),
                                location=str(row.get("location", "")) or None,
                                description=str(row.get("description", "")) or None,
                                job_url=str(row.get("job_url", "")),
                                salary_range=salary_range,
                                date_posted=date_posted,
                                source=str(row.get("site", "unknown")),
                            )
                            all_jobs.append(job)
                        except Exception as e:
                            logger.warning(f"Error parsing job row: {e}")
                            continue

                    logger.info(
                        f"Found {len(jobs_df)} jobs for '{term}' in '{location}'"
                    )

                except Exception as e:
                    logger.error(f"Search failed for '{term}' in '{location}': {e}")
                    continue

        # Deduplicate by URL
        seen_urls: set[str] = set()
        unique_jobs: list[ScrapedJob] = []
        for job in all_jobs:
            if job.job_url and job.job_url not in seen_urls:
                seen_urls.add(job.job_url)
                unique_jobs.append(job)

        logger.info(f"Total unique jobs found: {len(unique_jobs)}")
        return unique_jobs


# Scraper registry
SCRAPERS: dict[str, type[JobScraperBase]] = {
    "mock": MockScraper,
    "jobspy": JobSpyScraper,
}


def get_scraper(
    scraper_type: Literal["mock", "jobspy"] = "jobspy",
) -> JobScraperBase:
    """Get a scraper instance by type.

    Args:
        scraper_type: The type of scraper to use

    Returns:
        An instance of the requested scraper
    """
    scraper_class = SCRAPERS.get(scraper_type)
    if scraper_class is None:
        raise ValueError(f"Unknown scraper type: {scraper_type}")
    return scraper_class()

