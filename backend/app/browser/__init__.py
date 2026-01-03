"""Browser automation module.

Provides Playwright-based browser automation for job application analysis,
form filling capabilities, and job description scraping.
"""

from app.browser.client import close_browser, get_browser, get_page
from app.browser.job_scraper import (
    ScrapedDescription,
    scrape_job_description,
    scrape_job_descriptions_batch,
)

__all__ = [
    "ScrapedDescription",
    "close_browser",
    "get_browser",
    "get_page",
    "scrape_job_description",
    "scrape_job_descriptions_batch",
]
