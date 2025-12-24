"""Job search pipeline module.

This module contains the job search pipeline for scraping, analyzing,
and storing job listings based on user preferences.
"""

from app.pipelines.actions.job_search.pipeline import (
    JobSearchInput,
    JobSearchOutput,
    JobSearchPipeline,
)

__all__ = [
    "JobSearchInput",
    "JobSearchOutput",
    "JobSearchPipeline",
]
