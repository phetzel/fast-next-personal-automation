"""Job Search Pipeline.

Main pipeline that orchestrates job scraping, analysis, and storage.
"""

import logging
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.db.session import get_db_context
from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.actions.job_search.analyzer import analyze_jobs_batch
from app.pipelines.actions.job_search.scraper import SearchConfig, get_scraper
from app.pipelines.registry import register_pipeline
from app.repositories import job_profile_repo
from app.schemas.job import JobSummary
from app.schemas.job_profile import JobProfileSummary, ProfileRequiredError

logger = logging.getLogger(__name__)


class JobSearchInput(BaseModel):
    """Input for the job search pipeline.

    The form only shows profile_id and scraper. Other settings use sensible
    defaults derived from the selected profile (target_roles, target_locations, etc.).
    """

    profile_id: UUID | None = Field(
        default=None,
        description="Job profile to use for search terms and resume matching.",
        json_schema_extra={"format": "x-profile-select"},
    )
    scraper: Literal["jobspy", "mock"] = Field(
        default="jobspy",
        description="Data source (jobspy for real jobs, mock for testing)",
    )
    # Hidden fields with sensible defaults - not shown in form
    hours_old: int = Field(
        default=72,
        ge=1,
        le=720,
        description="Maximum age of job postings in hours",
        json_schema_extra={"x-hidden": True},
    )
    results_per_term: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Number of results per search term",
        json_schema_extra={"x-hidden": True},
    )
    save_all: bool = Field(
        default=False,
        description="Save all jobs regardless of score (for review)",
        json_schema_extra={"x-hidden": True},
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
    tags = ["jobs", "scraping", "ai"]
    area = "jobs"

    async def execute(
        self,
        input: JobSearchInput,
        context: PipelineContext,
    ) -> ActionResult[JobSearchOutput]:
        """Execute the job search pipeline."""
        logger.info("Starting job search pipeline")

        # Require user context for personalized search
        if context.user_id is None:
            return ActionResult(
                success=False,
                error="User authentication required for job search",
            )

        # Get the profile - either by ID or fall back to default
        async with get_db_context() as db:
            if input.profile_id is not None:
                # Use the specified profile
                profile = await job_profile_repo.get_by_id(db, input.profile_id)
                if profile is None or profile.user_id != context.user_id:
                    # Profile not found or doesn't belong to user
                    all_profiles = await job_profile_repo.get_by_user_id(db, context.user_id)
                    available_profiles = [
                        JobProfileSummary(
                            id=p.id,
                            name=p.name,
                            is_default=p.is_default,
                            has_resume=p.resume is not None and p.resume.text_content is not None,
                            resume_name=p.resume.name if p.resume else None,
                            target_roles_count=len(p.target_roles) if p.target_roles else 0,
                            min_score_threshold=p.min_score_threshold,
                        )
                        for p in all_profiles
                    ]
                    error_data = ProfileRequiredError(
                        message="The selected profile was not found or you don't have access to it.",
                        available_profiles=available_profiles,
                    )
                    return ActionResult(
                        success=False,
                        error=error_data.model_dump_json(),
                        metadata={"error_type": "profile_required"},
                    )
            else:
                # Fall back to default profile
                profile = await job_profile_repo.get_default_for_user(db, context.user_id)

        # Handle no profile case with structured error
        if profile is None:
            async with get_db_context() as db:
                all_profiles = await job_profile_repo.get_by_user_id(db, context.user_id)
                available_profiles = [
                    JobProfileSummary(
                        id=p.id,
                        name=p.name,
                        is_default=p.is_default,
                        has_resume=p.resume is not None and p.resume.text_content is not None,
                        resume_name=p.resume.name if p.resume else None,
                        target_roles_count=len(p.target_roles) if p.target_roles else 0,
                        min_score_threshold=p.min_score_threshold,
                    )
                    for p in all_profiles
                ]
            if available_profiles:
                error_data = ProfileRequiredError(
                    message="No default profile set. Please select a profile to use for job search.",
                    available_profiles=available_profiles,
                )
            else:
                error_data = ProfileRequiredError(
                    message="No job profiles found. Please create a profile before searching for jobs.",
                    available_profiles=[],
                )
            return ActionResult(
                success=False,
                error=error_data.model_dump_json(),
                metadata={"error_type": "profile_required"},
            )

        # Get resume text from linked resume
        if not profile.resume or not profile.resume.text_content:
            async with get_db_context() as db:
                all_profiles = await job_profile_repo.get_by_user_id(db, context.user_id)
                available_profiles = [
                    JobProfileSummary(
                        id=p.id,
                        name=p.name,
                        is_default=p.is_default,
                        has_resume=p.resume is not None and p.resume.text_content is not None,
                        resume_name=p.resume.name if p.resume else None,
                        target_roles_count=len(p.target_roles) if p.target_roles else 0,
                        min_score_threshold=p.min_score_threshold,
                    )
                    for p in all_profiles
                ]
            error_data = ProfileRequiredError(
                message=f"Profile '{profile.name}' has no resume linked. Please add a resume to the profile or select a different profile.",
                available_profiles=available_profiles,
            )
            return ActionResult(
                success=False,
                error=error_data.model_dump_json(),
                metadata={"error_type": "profile_required"},
            )

        resume_text = profile.resume.text_content
        target_roles = profile.target_roles or []
        target_locations = profile.target_locations or ["Remote"]
        min_score = profile.min_score_threshold or 7.0

        # Derive search terms from profile
        search_terms = target_roles if target_roles else ["Software Engineer"]
        search_locations = target_locations if target_locations else ["Remote"]

        logger.info(
            f"Searching for: terms={search_terms}, locations={search_locations}"
        )

        # Step 1: Scrape jobs
        try:
            scraper = get_scraper(input.scraper)
            search_config = SearchConfig(
                terms=search_terms,
                locations=search_locations,
                is_remote="Remote" in search_locations,
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
        search_terms_str = ", ".join(search_terms)

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
                "search_terms": search_terms,
                "locations": search_locations,
                "min_score": min_score,
                "profile_name": profile.name,
            },
        )

