"""Batch Job Prep Pipeline.

Prepares all NEW jobs in a single operation, using each job's associated profile.
"""

import asyncio
import logging
from typing import ClassVar, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.db.models.job import JobStatus
from app.db.session import get_db_context
from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.actions.job_prep.pipeline import JobPrepInput, JobPrepPipeline
from app.pipelines.registry import register_pipeline
from app.repositories import job_profile_repo, job_repo
from app.schemas.job import JobFilters

logger = logging.getLogger(__name__)


class BatchJobPrepInput(BaseModel):
    """Input for the batch job prep pipeline.

    Simple configuration - gets ALL new jobs and uses each job's associated profile.
    """

    tone: Literal["professional", "conversational", "enthusiastic"] = Field(
        default="professional",
        description="Tone for the cover letters",
    )
    max_jobs: int = Field(
        default=20,
        ge=1,
        le=50,
        description="Maximum number of jobs to prep in one batch (1-50)",
    )
    max_concurrent: int = Field(
        default=3,
        ge=1,
        le=5,
        description="Maximum concurrent jobs to process (1-5)",
        json_schema_extra={"x-hidden": True},
    )


class PrepResult(BaseModel):
    """Result for a single job prep."""

    job_id: UUID
    job_title: str
    company: str
    success: bool
    profile_used: str | None = None
    error: str | None = None


class BatchJobPrepOutput(BaseModel):
    """Output from the batch job prep pipeline."""

    total_processed: int = Field(description="Total jobs attempted")
    successful: int = Field(description="Jobs prepped successfully")
    failed: int = Field(description="Jobs that failed to prep")
    skipped: int = Field(description="Jobs skipped (already prepped, no profile, etc.)")
    results: list[PrepResult] = Field(description="Individual job results")


@register_pipeline
class BatchJobPrepPipeline(ActionPipeline[BatchJobPrepInput, BatchJobPrepOutput]):
    """Batch job prep pipeline that preps all NEW jobs.

    This pipeline:
    1. Fetches all jobs with status NEW
    2. For each job, uses the profile_id saved with the job (from job_search)
    3. Falls back to user's default profile if no profile_id on job
    4. Processes jobs concurrently (up to max_concurrent)
    5. Returns a summary of results

    This is useful for:
    - Batch prepping all new jobs after running job_search
    - Catching up on job prep after multiple searches

    Can be invoked via:
    - API: POST /api/v1/pipelines/job_prep_batch/execute
    - Agent: "Prep all my new jobs"
    """

    name = "job_prep_batch"
    description = "Batch prepare cover letters and notes for all new jobs"
    tags: ClassVar[list[str]] = ["jobs", "ai", "writing", "batch"]
    area: ClassVar[str | None] = "jobs"

    async def execute(
        self,
        input: BatchJobPrepInput,
        context: PipelineContext,
    ) -> ActionResult[BatchJobPrepOutput]:
        """Execute the batch job prep pipeline."""
        logger.info(f"Starting batch job prep, max_jobs={input.max_jobs}")

        # Require user context
        if context.user_id is None:
            return ActionResult(
                success=False,
                error="User authentication required for batch job prep",
            )

        # Step 1: Fetch all NEW jobs
        async with get_db_context() as db:
            filters = JobFilters(
                status=JobStatus.NEW,
                page=1,
                page_size=input.max_jobs,
                sort_by="relevance_score",
                sort_order="desc",
            )
            jobs, total = await job_repo.get_by_user(db, context.user_id, filters)

            # Also get the default profile as fallback
            default_profile = await job_profile_repo.get_default_for_user(db, context.user_id)

        if not jobs:
            return ActionResult(
                success=True,
                output=BatchJobPrepOutput(
                    total_processed=0,
                    successful=0,
                    failed=0,
                    skipped=0,
                    results=[],
                ),
                metadata={"message": "No NEW jobs found to prep"},
            )

        logger.info(f"Found {len(jobs)} NEW jobs to prep (total matching: {total})")

        # Step 2: Process jobs concurrently with semaphore
        semaphore = asyncio.Semaphore(input.max_concurrent)
        prep_pipeline = JobPrepPipeline()

        async def prep_single_job(job) -> PrepResult:
            async with semaphore:
                logger.info(f"Prepping job: {job.title} at {job.company}")

                # Skip if already prepped
                if job.prepped_at is not None:
                    return PrepResult(
                        job_id=job.id,
                        job_title=job.title,
                        company=job.company,
                        success=True,
                        error="Skipped: already prepped",
                    )

                # Determine which profile to use:
                # 1. Use job's profile_id if set (from job_search)
                # 2. Fall back to default profile
                profile_id_to_use = job.profile_id
                profile_name = None

                if profile_id_to_use is None:
                    if default_profile is None:
                        return PrepResult(
                            job_id=job.id,
                            job_title=job.title,
                            company=job.company,
                            success=False,
                            error="No profile: job has no profile_id and no default profile exists",
                        )
                    profile_id_to_use = default_profile.id
                    profile_name = default_profile.name
                else:
                    # Get profile name for the result
                    async with get_db_context() as db:
                        job_profile = await job_profile_repo.get_by_id(db, profile_id_to_use)
                        if job_profile:
                            profile_name = job_profile.name
                        else:
                            # Profile was deleted, fall back to default
                            if default_profile is None:
                                return PrepResult(
                                    job_id=job.id,
                                    job_title=job.title,
                                    company=job.company,
                                    success=False,
                                    error="Profile deleted and no default profile exists",
                                )
                            profile_id_to_use = default_profile.id
                            profile_name = default_profile.name

                try:
                    prep_input = JobPrepInput(
                        job_id=job.id,
                        profile_id=profile_id_to_use,
                        tone=input.tone,
                        generate_screening_answers=False,
                        auto_analyze=False,
                    )
                    result = await prep_pipeline.execute(prep_input, context)

                    if result.success:
                        return PrepResult(
                            job_id=job.id,
                            job_title=job.title,
                            company=job.company,
                            success=True,
                            profile_used=profile_name,
                        )
                    else:
                        return PrepResult(
                            job_id=job.id,
                            job_title=job.title,
                            company=job.company,
                            success=False,
                            profile_used=profile_name,
                            error=result.error,
                        )
                except Exception as e:
                    logger.exception(f"Failed to prep job {job.id}: {e}")
                    return PrepResult(
                        job_id=job.id,
                        job_title=job.title,
                        company=job.company,
                        success=False,
                        profile_used=profile_name,
                        error=str(e),
                    )

        # Run all jobs concurrently
        results = await asyncio.gather(
            *[prep_single_job(job) for job in jobs],
            return_exceptions=False,
        )

        # Compile stats
        successful = sum(1 for r in results if r.success and r.error is None)
        skipped = sum(1 for r in results if r.success and r.error is not None)
        failed = sum(1 for r in results if not r.success)

        logger.info(
            f"Batch prep complete: {successful} successful, {skipped} skipped, {failed} failed"
        )

        return ActionResult(
            success=True,
            output=BatchJobPrepOutput(
                total_processed=len(results),
                successful=successful,
                failed=failed,
                skipped=skipped,
                results=results,
            ),
            metadata={
                "tone": input.tone,
                "jobs_found": len(jobs),
                "total_new_jobs": total,
            },
        )
