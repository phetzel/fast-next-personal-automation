"""Batch Job Search Pipeline.

Runs job search for all of the user's job profiles concurrently.
"""

import asyncio
import logging
from typing import ClassVar
from uuid import UUID

from pydantic import BaseModel, Field

from app.db.session import get_db_context
from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.actions.job_search.pipeline import JobSearchInput, JobSearchPipeline
from app.pipelines.registry import register_pipeline
from app.repositories import job_profile_repo

logger = logging.getLogger(__name__)


class ProfileSearchResult(BaseModel):
    """Result for a single profile's job search."""

    profile_id: UUID
    profile_name: str
    success: bool
    jobs_saved: int = 0
    high_scoring: int = 0
    error: str | None = None


class BatchJobSearchInput(BaseModel):
    """Input for the batch job search pipeline.

    All profiles are searched automatically - no profile selection needed.
    """

    # Search parameters
    hours_old: int = Field(
        default=72,
        ge=1,
        le=720,
        description="Only include jobs posted within this many hours (e.g., 24, 48, 72)",
    )
    results_per_term: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Number of results per search term",
        json_schema_extra={"x-hidden": True},
    )


class BatchJobSearchOutput(BaseModel):
    """Output from the batch job search pipeline."""

    total_profiles: int = Field(description="Number of profiles searched")
    successful: int = Field(description="Number of successful searches")
    failed: int = Field(description="Number of failed searches")
    total_jobs_saved: int = Field(description="Total jobs saved across all profiles")
    total_high_scoring: int = Field(description="Total high-scoring jobs found")
    results: list[ProfileSearchResult] = Field(
        default_factory=list,
        description="Per-profile search results",
    )


@register_pipeline
class BatchJobSearchPipeline(ActionPipeline[BatchJobSearchInput, BatchJobSearchOutput]):
    """Batch job search that runs for all user profiles.

    This pipeline:
    1. Gets all job profiles for the user
    2. Runs job_search for each profile concurrently
    3. Aggregates and returns results

    Prerequisites:
    - User must have at least one job profile with a resume linked

    Can be invoked via:
    - API: POST /api/v1/pipelines/job_search_batch/execute
    - Agent: "Search for jobs across all my profiles"
    """

    name = "job_search_batch"
    description = "Search for jobs across all your job profiles"
    tags: ClassVar[list[str]] = ["jobs", "scraping", "ai", "batch"]
    area: ClassVar[str | None] = "jobs"

    async def execute(
        self,
        input: BatchJobSearchInput,
        context: PipelineContext,
    ) -> ActionResult[BatchJobSearchOutput]:
        """Execute the batch job search pipeline."""
        logger.info("Starting batch job search pipeline")

        # Require user context
        if context.user_id is None:
            return ActionResult(
                success=False,
                error="User authentication required for job search",
            )

        # Get all profiles for the user
        async with get_db_context() as db:
            profiles = await job_profile_repo.get_by_user_id(db, context.user_id)

        if not profiles:
            return ActionResult(
                success=False,
                error="No job profiles found. Please create at least one profile before searching.",
            )

        # Filter to profiles that have resumes (required for search)
        valid_profiles = [p for p in profiles if p.resume and p.resume.text_content]

        if not valid_profiles:
            return ActionResult(
                success=False,
                error="No profiles with resumes found. Please add a resume to at least one profile.",
            )

        logger.info(f"Running job search for {len(valid_profiles)} profiles")

        # Create search tasks for each profile
        search_pipeline = JobSearchPipeline()

        async def search_profile(profile) -> ProfileSearchResult:
            """Search jobs for a single profile."""
            try:
                search_input = JobSearchInput(
                    profile_id=profile.id,
                    scraper="jobspy",
                    hours_old=input.hours_old,
                    results_per_term=input.results_per_term,
                )
                result = await search_pipeline.execute(search_input, context)

                if result.success and result.output:
                    return ProfileSearchResult(
                        profile_id=profile.id,
                        profile_name=profile.name,
                        success=True,
                        jobs_saved=result.output.jobs_saved,
                        high_scoring=result.output.high_scoring,
                    )
                else:
                    return ProfileSearchResult(
                        profile_id=profile.id,
                        profile_name=profile.name,
                        success=False,
                        error=result.error or "Unknown error",
                    )
            except Exception as e:
                logger.exception(f"Search failed for profile {profile.name}")
                return ProfileSearchResult(
                    profile_id=profile.id,
                    profile_name=profile.name,
                    success=False,
                    error=str(e),
                )

        # Run searches concurrently (limit to 3 at a time to avoid rate limiting)
        semaphore = asyncio.Semaphore(3)

        async def limited_search(profile):
            async with semaphore:
                return await search_profile(profile)

        results = await asyncio.gather(
            *[limited_search(p) for p in valid_profiles],
            return_exceptions=False,
        )

        # Aggregate results
        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful
        total_jobs_saved = sum(r.jobs_saved for r in results)
        total_high_scoring = sum(r.high_scoring for r in results)

        return ActionResult(
            success=True,
            output=BatchJobSearchOutput(
                total_profiles=len(valid_profiles),
                successful=successful,
                failed=failed,
                total_jobs_saved=total_jobs_saved,
                total_high_scoring=total_high_scoring,
                results=results,
            ),
            metadata={
                "profiles_searched": [p.name for p in valid_profiles],
            },
        )
