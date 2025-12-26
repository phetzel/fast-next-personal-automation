"""Playwright browser client for web automation.

Provides browser lifecycle management with singleton pattern for efficient
resource usage across multiple pipeline executions.
"""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

from app.core.config import settings

logger = logging.getLogger(__name__)

# Global browser instance (reuse across requests)
_browser: Browser | None = None
_playwright_instance = None


async def get_browser() -> Browser:
    """Get or create browser instance.

    Returns a singleton browser instance that can be reused across
    multiple page sessions for efficiency.

    Returns:
        Browser: Playwright browser instance
    """
    global _browser, _playwright_instance

    if _browser is None or not _browser.is_connected():
        logger.info("Creating new browser instance")
        _playwright_instance = await async_playwright().start()
        _browser = await _playwright_instance.chromium.launch(
            headless=settings.BROWSER_HEADLESS,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu",
            ],
        )
        logger.info("Browser instance created successfully")

    return _browser


async def close_browser() -> None:
    """Close browser instance and cleanup resources.

    Should be called during application shutdown to properly release
    browser resources.
    """
    global _browser, _playwright_instance

    if _browser:
        logger.info("Closing browser instance")
        await _browser.close()
        _browser = None

    if _playwright_instance:
        await _playwright_instance.stop()
        _playwright_instance = None
        logger.info("Playwright instance stopped")


@asynccontextmanager
async def get_page(
    user_agent: str | None = None,
    viewport_width: int = 1280,
    viewport_height: int = 720,
) -> AsyncGenerator[Page, None]:
    """Get a new page context with automatic cleanup.

    Creates a new browser context and page for isolated browsing sessions.
    The context is automatically closed when exiting the context manager.

    Args:
        user_agent: Custom user agent string (uses default if not provided)
        viewport_width: Browser viewport width in pixels
        viewport_height: Browser viewport height in pixels

    Yields:
        Page: Playwright page object for browser interactions

    Example:
        async with get_page() as page:
            await page.goto("https://example.com")
            content = await page.content()
    """
    browser = await get_browser()

    # Create isolated browser context
    context: BrowserContext = await browser.new_context(
        user_agent=user_agent
        or (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        viewport={"width": viewport_width, "height": viewport_height},
        java_script_enabled=True,
        accept_downloads=False,
    )

    # Set default timeout
    context.set_default_timeout(settings.BROWSER_TIMEOUT)

    page = await context.new_page()

    try:
        yield page
    finally:
        await context.close()


@asynccontextmanager
async def get_persistent_context(
    storage_state_path: str | None = None,
) -> AsyncGenerator[tuple[BrowserContext, Page], None]:
    """Get a persistent browser context with optional saved state.

    Useful for maintaining login sessions across multiple operations.

    Args:
        storage_state_path: Path to load/save browser storage state (cookies, localStorage)

    Yields:
        Tuple of (BrowserContext, Page) for persistent session operations
    """
    browser = await get_browser()

    context_options = {
        "user_agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "viewport": {"width": 1280, "height": 720},
    }

    if storage_state_path:
        try:
            context_options["storage_state"] = storage_state_path
        except Exception:
            logger.warning(f"Could not load storage state from {storage_state_path}")

    context = await browser.new_context(**context_options)
    context.set_default_timeout(settings.BROWSER_TIMEOUT)
    page = await context.new_page()

    try:
        yield context, page
    finally:
        # Optionally save state before closing
        if storage_state_path:
            try:
                await context.storage_state(path=storage_state_path)
            except Exception as e:
                logger.warning(f"Could not save storage state: {e}")
        await context.close()
