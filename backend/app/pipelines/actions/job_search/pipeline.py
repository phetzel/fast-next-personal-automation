"""Job Search Pipeline.

Main pipeline that orchestrates job scraping, analysis, and storage.
"""

import logging
from typing import Literal

from pydantic import BaseModel, Field

from app.db.session import get_db_context
from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.actions.job_search.analyzer import analyze_jobs_batch
from app.pipelines.actions.job_search.scraper import SearchConfig, get_scraper
from app.pipelines.registry import register_pipeline
from app.repositories import user_profile_repo
from app.schemas.job import JobSummary

logger = logging.getLogger(__name__)


class JobSearchInput(BaseModel):
    """Input for the job search pipeline."""

    terms: list[str] = Field(
        default=["Python Developer"],
        description="Job titles/roles to search for",
    )
    locations: list[str] = Field(
        default=["Remote"],
        description="Locations to search (e.g., 'Remote', 'San Francisco, CA')",
    )
    is_remote: bool = Field(
        default=True,
        description="Filter for remote-only positions",
    )
    hours_old: int = Field(
        default=24,
        ge=1,
        le=720,
        description="Maximum age of job postings in hours",
    )
    results_per_term: int = Field(
        default=5,
        ge=1,
        le=50,
        description="Number of results per search term",
    )
    min_score: float = Field(
        default=7.0,
        ge=0.0,
        le=10.0,
        description="Minimum relevance score to save a job",
    )
    save_all: bool = Field(
        default=False,
        description="Save all jobs regardless of score (for review)",
    )
    scraper: Literal["jobspy", "mock"] = Field(
        default="jobspy",
        description="Scraper to use (jobspy for real data, mock for testing)",
    )


class JobSearchOutput(BaseModel):
    """Output from the job search pipeline."""

    total_scraped: int = Field(description="Number of jobs scraped from sources")
    total_analyzed: int = Field(description="Number of jobs analyzed with AI")
    jobs_saved: int = Field(description="Number of jobs saved to database")
    high_scoring: int = Field(description="Number of jobs with score >= min_score")
    duplicates_skipped: int = Field(description="Number of duplicate jobs skipped")
    top_jobs: list[JobSummary] = Field(
        default_factory=list,
        description="Top 5 highest-scoring jobs from this run",
    )


@register_pipeline
class JobSearchPipeline(ActionPipeline[JobSearchInput, JobSearchOutput]):
    """Job search pipeline that scrapes, analyzes, and stores job listings.

    This pipeline:
    1. Scrapes job listings from LinkedIn, Indeed, Glassdoor (via python-jobspy)
    2. Analyzes each job against the user's resume using AI
    3. Stores jobs that meet the minimum score threshold
    4. Skips duplicates based on job URL

    Prerequisites:
    - User must have a profile with resume_text set
    - For real scraping, python-jobspy must be installed

    Can be invoked via:
    - API: POST /api/v1/pipelines/job_search/execute
    - Agent: "Search for Python developer jobs in San Francisco"
    - Webhook: POST /api/v1/pipelines/webhook/job_search
    """

    name = "job_search"
    description = "Search for jobs and analyze fit against your resume"

    async def execute(
        self,
        input: JobSearchInput,
        context: PipelineContext,
    ) -> ActionResult[JobSearchOutput]:
        """Execute the job search pipeline."""
        logger.info(
            f"Starting job search: terms={input.terms}, locations={input.locations}"
        )

        # Require user context for personalized search
        if context.user_id is None:
            return ActionResult(
                success=False,
                error="User authentication required for job search",
            )

        # Get user profile with resume
        async with get_db_context() as db:
            profile = await user_profile_repo.get_by_user_id(db, context.user_id)

        if profile is None or not profile.resume_text:
            return ActionResult(
                success=False,
                error="Please set up your profile with a resume before searching for jobs. "
                "Go to Profile settings and paste your resume text.",
            )

        resume_text = profile.resume_text
        target_roles = profile.target_roles
        min_score = input.min_score

        # Use profile threshold if not specified in input
        if profile.min_score_threshold and input.min_score == 7.0:
            min_score = profile.min_score_threshold

        # Step 1: Scrape jobs
        try:
            scraper = get_scraper(input.scraper)
            search_config = SearchConfig(
                terms=input.terms,
                locations=input.locations,
                is_remote=input.is_remote,
                hours_old=input.hours_old,
                results_per_term=input.results_per_term,
            )
            scraped_jobs = await scraper.search(search_config)
        except ImportError as e:
            return ActionResult(
                success=False,
                error=f"Scraper not available: {e}. Try using scraper='mock' for testing.",
            )
        except Exception as e:
            logger.exception("Job scraping failed")
            return ActionResult(
                success=False,
                error=f"Job scraping failed: {e}",
            )

        if not scraped_jobs:
            return ActionResult(
                success=True,
                output=JobSearchOutput(
                    total_scraped=0,
                    total_analyzed=0,
                    jobs_saved=0,
                    high_scoring=0,
                    duplicates_skipped=0,
                    top_jobs=[],
                ),
                metadata={"message": "No jobs found matching search criteria"},
            )

        logger.info(f"Scraped {len(scraped_jobs)} jobs")

        # Step 2: Check for duplicates before analyzing
        async with get_db_context() as db:
            from app.repositories import job_repo

            existing_urls = set()
            for job in scraped_jobs:
                if await job_repo.get_by_url_and_user(db, job.job_url, context.user_id):
                    existing_urls.add(job.job_url)

        new_jobs = [j for j in scraped_jobs if j.job_url not in existing_urls]
        duplicates_skipped = len(scraped_jobs) - len(new_jobs)

        if not new_jobs:
            return ActionResult(
                success=True,
                output=JobSearchOutput(
                    total_scraped=len(scraped_jobs),
                    total_analyzed=0,
                    jobs_saved=0,
                    high_scoring=0,
                    duplicates_skipped=duplicates_skipped,
                    top_jobs=[],
                ),
                metadata={"message": "All scraped jobs were duplicates"},
            )

        logger.info(f"Analyzing {len(new_jobs)} new jobs (skipped {duplicates_skipped} duplicates)")

        # Step 3: Analyze jobs with AI
        try:
            analyzed_jobs = await analyze_jobs_batch(
                new_jobs,
                resume_text,
                target_roles=target_roles,
                preferences=profile.preferences,
                max_concurrent=5,
            )
        except Exception as e:
            logger.exception("Job analysis failed")
            return ActionResult(
                success=False,
                error=f"Job analysis failed: {e}",
            )

        # Step 4: Filter and save jobs
        high_scoring = 0
        jobs_to_save = []
        search_terms_str = ", ".join(input.terms)

        for scraped_job, analysis in analyzed_jobs:
            if analysis.relevance_score >= min_score:
                high_scoring += 1

            # Save if high-scoring or save_all is True
            if input.save_all or analysis.relevance_score >= min_score:
                jobs_to_save.append({
                    "title": scraped_job.title,
                    "company": scraped_job.company,
                    "location": scraped_job.location,
                    "description": scraped_job.description,
                    "job_url": scraped_job.job_url,
                    "salary_range": scraped_job.salary_range,
                    "date_posted": scraped_job.date_posted,
                    "source": scraped_job.source,
                    "relevance_score": analysis.relevance_score,
                    "reasoning": analysis.reasoning,
                    "search_terms": search_terms_str,
                })

        # Save to database
        saved_jobs = []
        if jobs_to_save:
            async with get_db_context() as db:
                from app.repositories import job_repo

                saved_jobs = await job_repo.create_bulk(
                    db, context.user_id, jobs_to_save
                )
                await db.commit()

        logger.info(
            f"Saved {len(saved_jobs)} jobs ({high_scoring} high-scoring)"
        )

        # Get top 5 jobs for output
        sorted_jobs = sorted(
            [(j, a) for j, a in analyzed_jobs],
            key=lambda x: x[1].relevance_score,
            reverse=True,
        )[:5]

        top_jobs = []
        for scraped_job, analysis in sorted_jobs:
            # Find saved job ID if it was saved
            saved_id = None
            for saved in saved_jobs:
                if saved.job_url == scraped_job.job_url:
                    saved_id = saved.id
                    break

            if saved_id:
                top_jobs.append(
                    JobSummary(
                        id=saved_id,
                        title=scraped_job.title,
                        company=scraped_job.company,
                        location=scraped_job.location,
                        relevance_score=analysis.relevance_score,
                        job_url=scraped_job.job_url,
                    )
                )

        return ActionResult(
            success=True,
            output=JobSearchOutput(
                total_scraped=len(scraped_jobs),
                total_analyzed=len(new_jobs),
                jobs_saved=len(saved_jobs),
                high_scoring=high_scoring,
                duplicates_skipped=duplicates_skipped,
                top_jobs=top_jobs,
            ),
            metadata={
                "search_terms": input.terms,
                "locations": input.locations,
                "min_score": min_score,
            },
        )

