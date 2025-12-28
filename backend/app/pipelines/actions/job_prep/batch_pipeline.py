"""Batch Job Prep Pipeline.

Prepares all jobs matching a filter (e.g., all NEW jobs) in a single operation.
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
from app.schemas.job_profile import JobProfileSummary, ProfileRequiredError

logger = logging.getLogger(__name__)


class BatchJobPrepInput(BaseModel):
    """Input for the batch job prep pipeline."""

    status: Literal["new", "prepped", "reviewed"] = Field(
        default="new",
        description="Only prep jobs with this status (default: 'new')",
    )
    profile_id: UUID | None = Field(
        default=None,
        description="Job profile to use. Uses default profile if not specified.",
        json_schema_extra={"format": "x-profile-select"},
    )
    tone: Literal["professional", "conversational", "enthusiastic"] = Field(
        default="professional",
        description="Tone for the cover letters",
    )
    max_jobs: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of jobs to prep in one batch (1-50)",
    )
    max_concurrent: int = Field(
        default=3,
        ge=1,
        le=5,
        description="Maximum concurrent jobs to process (1-5)",
    )
    min_score: float | None = Field(
        default=None,
        ge=0,
        le=10,
        description="Only prep jobs with relevance score >= this value",
    )


class PrepResult(BaseModel):
    """Result for a single job prep."""

    job_id: UUID
    job_title: str
    company: str
    success: bool
    error: str | None = None


class BatchJobPrepOutput(BaseModel):
    """Output from the batch job prep pipeline."""

    total_processed: int = Field(description="Total jobs attempted")
    successful: int = Field(description="Jobs prepped successfully")
    failed: int = Field(description="Jobs that failed to prep")
    skipped: int = Field(description="Jobs skipped (already prepped, etc.)")
    results: list[PrepResult] = Field(description="Individual job results")
    profile_used: str = Field(description="Name of the profile used")


@register_pipeline
class BatchJobPrepPipeline(ActionPipeline[BatchJobPrepInput, BatchJobPrepOutput]):
    """Batch job prep pipeline that preps multiple jobs at once.

    This pipeline:
    1. Fetches jobs matching the specified status
    2. Filters by min_score if specified
    3. Processes jobs concurrently (up to max_concurrent)
    4. Each job goes through the full job_prep process
    5. Returns a summary of results

    This is useful for:
    - Batch prepping all new high-scoring jobs
    - Catching up on job prep after a search
    - Re-prepping jobs with a different profile/tone

    Can be invoked via:
    - API: POST /api/v1/pipelines/job_prep_batch/execute
    - Agent: "Prep all my new jobs"
    """

    name = "job_prep_batch"
    description = "Batch prepare cover letters and notes for multiple jobs"
    tags: ClassVar[list[str]] = ["jobs", "ai", "writing", "batch"]
    area: ClassVar[str | None] = "jobs"

    async def execute(
        self,
        input: BatchJobPrepInput,
        context: PipelineContext,
    ) -> ActionResult[BatchJobPrepOutput]:
        """Execute the batch job prep pipeline."""
        logger.info(
            f"Starting batch job prep for status={input.status}, "
            f"max_jobs={input.max_jobs}, max_concurrent={input.max_concurrent}"
        )

        # Require user context
        if context.user_id is None:
            return ActionResult(
                success=False,
                error="User authentication required for batch job prep",
            )

        # Step 1: Validate profile exists
        async with get_db_context() as db:
            if input.profile_id is not None:
                profile = await job_profile_repo.get_by_id(db, input.profile_id)
                if profile is None or profile.user_id != context.user_id:
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
                        message="The selected profile was not found.",
                        available_profiles=available_profiles,
                    )
                    return ActionResult(
                        success=False,
                        error=error_data.model_dump_json(),
                        metadata={"error_type": "profile_required"},
                    )
            else:
                profile = await job_profile_repo.get_default_for_user(db, context.user_id)

            if profile is None:
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
                    message="No profile found. Please create a profile first.",
                    available_profiles=available_profiles,
                )
                return ActionResult(
                    success=False,
                    error=error_data.model_dump_json(),
                    metadata={"error_type": "profile_required"},
                )

            profile_name = profile.name
            profile_id = profile.id

        # Step 2: Fetch jobs matching criteria
        async with get_db_context() as db:
            filters = JobFilters(
                status=JobStatus(input.status),
                min_score=input.min_score,
                page=1,
                page_size=input.max_jobs,
                sort_by="relevance_score",
                sort_order="desc",
            )
            jobs, total = await job_repo.get_by_user(db, context.user_id, filters)

        if not jobs:
            return ActionResult(
                success=True,
                output=BatchJobPrepOutput(
                    total_processed=0,
                    successful=0,
                    failed=0,
                    skipped=0,
                    results=[],
                    profile_used=profile_name,
                ),
                metadata={"message": f"No jobs found with status '{input.status}'"},
            )

        logger.info(f"Found {len(jobs)} jobs to prep (total matching: {total})")

        # Step 3: Process jobs concurrently with semaphore
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

                try:
                    prep_input = JobPrepInput(
                        job_id=job.id,
                        profile_id=profile_id,
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
                        )
                    else:
                        return PrepResult(
                            job_id=job.id,
                            job_title=job.title,
                            company=job.company,
                            success=False,
                            error=result.error,
                        )
                except Exception as e:
                    logger.exception(f"Failed to prep job {job.id}: {e}")
                    return PrepResult(
                        job_id=job.id,
                        job_title=job.title,
                        company=job.company,
                        success=False,
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
                profile_used=profile_name,
            ),
            metadata={
                "profile_name": profile_name,
                "tone": input.tone,
                "status_filter": input.status,
                "min_score_filter": input.min_score,
            },
        )
