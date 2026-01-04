"""Job description scraper using Playwright.

Fetches full job descriptions from job listing URLs to enrich email-sourced jobs
with complete description text for better AI analysis.
"""

import asyncio
import logging
from dataclasses import dataclass

from playwright.async_api import Page
from playwright.async_api import TimeoutError as PlaywrightTimeout

from app.browser.client import get_page
from app.core.config import settings

logger = logging.getLogger(__name__)

# Common selectors for job descriptions on different platforms
JOB_DESCRIPTION_SELECTORS = {
    "linkedin.com": [
        ".description__text",
        ".jobs-description__content",
        ".jobs-description",
        '[class*="job-description"]',
        ".show-more-less-html__markup",
    ],
    "indeed.com": [
        "#jobDescriptionText",
        ".jobsearch-jobDescriptionText",
        '[class*="jobDescription"]',
    ],
    "glassdoor.com": [
        ".JobDetails_jobDescription__uW_fK",
        ".desc",
        '[class*="jobDescription"]',
        ".jobDescriptionContent",
    ],
    "lever.co": [
        ".posting-headline",
        ".posting-categories",
        ".posting-requirements",
        "[data-qa='posting-content']",
        ".content",
    ],
    "greenhouse.io": [
        "#content",
        ".job-description",
        '[class*="job_description"]',
        ".app-body",
    ],
    "dice.com": [
        "#jobDescription",
        ".job-description",
        '[data-testid="job-description"]',
    ],
    "ziprecruiter.com": [
        ".job_description",
        ".jobDescriptionSection",
        '[class*="job-description"]',
    ],
    "hiringcafe.com": [
        ".job-description",
        ".job-details",
        "[class*='description']",
    ],
}

# Fallback selectors if domain-specific ones don't work
FALLBACK_SELECTORS = [
    ".job-description",
    ".description",
    "#job-description",
    "#description",
    '[class*="job-description"]',
    '[class*="jobDescription"]',
    '[data-testid*="description"]',
    "article",
    "main",
]


@dataclass
class ScrapedDescription:
    """Result of scraping a job description."""

    url: str
    description: str | None
    success: bool
    error: str | None = None


async def _extract_text_from_selectors(page: Page, selectors: list[str]) -> str | None:
    """Try each selector until we find text content."""
    for selector in selectors:
        try:
            element = await page.query_selector(selector)
            if element:
                text = await element.inner_text()
                # Clean up and validate
                text = text.strip()
                if len(text) > 100:  # Minimum viable description length
                    return text
        except Exception as e:
            logger.debug(f"Selector {selector} failed: {e}")
            continue
    return None


def _get_domain_selectors(url: str) -> list[str]:
    """Get domain-specific selectors for a URL."""
    url_lower = url.lower()
    for domain, selectors in JOB_DESCRIPTION_SELECTORS.items():
        if domain in url_lower:
            return selectors
    return []


async def scrape_job_description(url: str, timeout: int = 30000) -> ScrapedDescription:
    """Scrape the full job description from a job listing URL.

    Uses Playwright to render the page and extract the job description text.
    Tries domain-specific selectors first, then falls back to generic ones.

    Args:
        url: The job listing URL to scrape
        timeout: Page load timeout in milliseconds

    Returns:
        ScrapedDescription with the extracted text or error info
    """
    logger.info(f"Scraping job description from: {url}")

    try:
        async with get_page() as page:
            # Navigate to the page
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
                # Wait a bit for JS rendering
                await asyncio.sleep(2)
            except PlaywrightTimeout:
                logger.warning(f"Timeout loading page: {url}")
                return ScrapedDescription(
                    url=url,
                    description=None,
                    success=False,
                    error="Page load timeout",
                )

            # Try domain-specific selectors first
            domain_selectors = _get_domain_selectors(url)
            description = await _extract_text_from_selectors(page, domain_selectors)

            # Fall back to generic selectors
            if not description:
                description = await _extract_text_from_selectors(page, FALLBACK_SELECTORS)

            # Last resort: try to get the main content
            if not description:
                try:
                    # Try to get all visible text from main content area
                    body = await page.query_selector("body")
                    if body:
                        full_text = await body.inner_text()
                        # Basic cleanup - remove obvious noise
                        lines = [
                            line.strip()
                            for line in full_text.split("\n")
                            if line.strip() and len(line.strip()) > 20
                        ]
                        if lines:
                            description = "\n".join(lines[:100])  # Limit to first 100 lines
                except Exception as e:
                    logger.debug(f"Body text extraction failed: {e}")

            if description:
                # Truncate very long descriptions
                max_length = (
                    settings.MAX_JOB_DESCRIPTION_LENGTH
                    if hasattr(settings, "MAX_JOB_DESCRIPTION_LENGTH")
                    else 15000
                )
                if len(description) > max_length:
                    description = description[:max_length] + "\n...[truncated]"

                logger.info(f"Successfully scraped description ({len(description)} chars)")
                return ScrapedDescription(
                    url=url,
                    description=description,
                    success=True,
                )
            else:
                logger.warning(f"Could not find job description on page: {url}")
                return ScrapedDescription(
                    url=url,
                    description=None,
                    success=False,
                    error="Could not locate job description on page",
                )

    except Exception as e:
        logger.exception(f"Error scraping job description from {url}: {e}")
        return ScrapedDescription(
            url=url,
            description=None,
            success=False,
            error=str(e),
        )


async def scrape_job_descriptions_batch(
    urls: list[str],
    max_concurrent: int = 3,
    timeout: int = 30000,
) -> dict[str, ScrapedDescription]:
    """Scrape job descriptions from multiple URLs concurrently.

    Args:
        urls: List of job listing URLs to scrape
        max_concurrent: Maximum concurrent scraping tasks
        timeout: Page load timeout per URL in milliseconds

    Returns:
        Dict mapping URL to ScrapedDescription
    """
    logger.info(f"Batch scraping {len(urls)} job descriptions (max concurrent: {max_concurrent})")

    results: dict[str, ScrapedDescription] = {}
    semaphore = asyncio.Semaphore(max_concurrent)

    async def scrape_with_limit(url: str) -> tuple[str, ScrapedDescription]:
        async with semaphore:
            result = await scrape_job_description(url, timeout)
            return url, result

    tasks = [scrape_with_limit(url) for url in urls]
    completed = await asyncio.gather(*tasks, return_exceptions=True)

    for item in completed:
        if isinstance(item, Exception):
            logger.error(f"Batch scrape task failed: {item}")
            continue
        url, result = item
        results[url] = result

    success_count = sum(1 for r in results.values() if r.success)
    logger.info(f"Batch scrape complete: {success_count}/{len(urls)} successful")

    return results


