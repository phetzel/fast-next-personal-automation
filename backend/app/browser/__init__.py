"""Browser automation module.

Provides Playwright-based browser automation for job application analysis
and form filling capabilities.
"""

from app.browser.client import close_browser, get_browser, get_page

__all__ = ["close_browser", "get_browser", "get_page"]
