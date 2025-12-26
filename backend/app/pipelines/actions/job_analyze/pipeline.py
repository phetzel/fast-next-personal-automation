"""Job Analyze Pipeline.

Analyzes job application pages to detect requirements before prep.
"""

import logging
from datetime import UTC, datetime
from typing import ClassVar, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.browser.ai_analyzer import smart_analyze
from app.browser.client import get_page
from app.browser.extractors import analyze_application_page
from app.db.session import get_db_context
from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.registry import register_pipeline
from app.repositories import job_repo

logger = logging.getLogger(__name__)


class JobAnalyzeInput(BaseModel):
    """Input for the job analyze pipeline."""

    job_id: UUID = Field(
        description="Select a job to analyze application requirements for",
        json_schema_extra={"format": "x-job-select"},
    )
    use_ai: bool = Field(
        default=False,
        description="Use AI for deeper analysis (slower but more accurate for complex pages)",
    )
    navigate_to_apply: bool = Field(
        default=True,
        description="Click apply button to reach the actual application form",
    )


class DetectedField(BaseModel):
    """A detected form field."""

    name: str
    field_type: str
    label: str | None = None
    required: bool = False
    placeholder: str | None = None
    options: list[str] = Field(default_factory=list)


class DetectedQuestion(BaseModel):
    """A detected screening question."""

    question: str
    field_type: str
    required: bool = False
    options: list[str] = Field(default_factory=list)


class JobAnalyzeOutput(BaseModel):
    """Output from the job analyze pipeline."""

    job_id: UUID = Field(description="ID of the analyzed job")
    job_title: str = Field(description="Title of the job")
    company: str = Field(description="Company name")
    application_type: Literal["easy_apply", "ats", "direct", "email", "unknown"] = Field(
        description="Type of application process"
    )
    application_url: str = Field(description="URL to the application form")
    requires_cover_letter: bool = Field(description="Whether cover letter is required")
    requires_resume: bool = Field(description="Whether resume upload is required")
    detected_fields_count: int = Field(description="Number of form fields detected")
    screening_questions_count: int = Field(description="Number of screening questions")
    estimated_time_minutes: int = Field(description="Estimated time to complete application")
    analysis_method: str = Field(description="Method used for analysis (dom or ai)")


@register_pipeline
class JobAnalyzePipeline(ActionPipeline[JobAnalyzeInput, JobAnalyzeOutput]):
    """Job analyze pipeline that inspects application pages.

    This pipeline:
    1. Navigates to the job URL
    2. Optionally clicks the apply button to reach the application form
    3. Detects the application type (Easy Apply, ATS, Direct, Email)
    4. Identifies required fields and cover letter requirements
    5. Extracts screening questions
    6. Updates the job record with analysis results

    Prerequisites:
    - Job must exist and belong to the user
    - Job must have a valid job_url

    Can be invoked via:
    - API: POST /api/v1/pipelines/job_analyze/execute
    - Agent: "Analyze the application for this job"
    - Webhook: POST /api/v1/pipelines/webhook/job_analyze
    """

    name = "job_analyze"
    description = "Analyze job application page to detect requirements and form fields"
    tags: ClassVar[list[str]] = ["jobs", "browser", "analysis"]
    area: ClassVar[str | None] = "jobs"

    async def execute(
        self,
        input: JobAnalyzeInput,
        context: PipelineContext,
    ) -> ActionResult[JobAnalyzeOutput]:
        """Execute the job analyze pipeline."""
        logger.info(f"Starting job analyze pipeline for job {input.job_id}")

        # Require user context
        if context.user_id is None:
            return ActionResult(
                success=False,
                error="User authentication required for job analysis",
            )

        # Step 1: Get the job
        async with get_db_context() as db:
            job = await job_repo.get_by_id_and_user(db, input.job_id, context.user_id)

        if job is None:
            return ActionResult(
                success=False,
                error=f"Job not found or you don't have access to it: {input.job_id}",
            )

        if not job.job_url:
            return ActionResult(
                success=False,
                error="Job does not have a URL to analyze",
            )

        # Step 2: Analyze the page
        logger.info(f"Analyzing job page: {job.job_url}")
        analysis_method = "dom"

        try:
            if input.use_ai:
                # Use AI-powered analysis
                analysis_method = "ai"
                analysis = await smart_analyze(job.job_url, use_ai=True)
            else:
                # Use traditional DOM-based analysis
                async with get_page() as page:
                    await page.goto(job.job_url, wait_until="networkidle")

                    # Optionally navigate to apply page
                    if input.navigate_to_apply:
                        await self._navigate_to_apply(page)

                    analysis = await analyze_application_page(page)

        except Exception as e:
            logger.exception(f"Failed to analyze job page: {e}")
            return ActionResult(
                success=False,
                error=f"Failed to analyze application page: {e}",
            )

        # Step 3: Update job record with analysis results
        async with get_db_context() as db:
            job = await job_repo.get_by_id_and_user(db, input.job_id, context.user_id)
            if job:
                update_data = {
                    "application_type": analysis.application_type.value,
                    "application_url": analysis.application_url,
                    "requires_cover_letter": analysis.requires_cover_letter,
                    "requires_resume": analysis.requires_resume,
                    "detected_fields": {
                        "fields": [f.to_dict() for f in analysis.fields],
                        "count": len(analysis.fields),
                    },
                    "screening_questions": [q.to_dict() for q in analysis.screening_questions],
                    "analyzed_at": datetime.now(UTC),
                }
                await job_repo.update(db, db_job=job, update_data=update_data)
                await db.commit()
                logger.info(f"Updated job {job.id} with analysis results")

        return ActionResult(
            success=True,
            output=JobAnalyzeOutput(
                job_id=input.job_id,
                job_title=job.title,
                company=job.company,
                application_type=analysis.application_type.value,
                application_url=analysis.application_url,
                requires_cover_letter=analysis.requires_cover_letter,
                requires_resume=analysis.requires_resume,
                detected_fields_count=len(analysis.fields),
                screening_questions_count=len(analysis.screening_questions),
                estimated_time_minutes=analysis.estimated_time_minutes,
                analysis_method=analysis_method,
            ),
            metadata={
                "job_url": job.job_url,
                "fields": [f.to_dict() for f in analysis.fields[:5]],  # First 5 fields
                "questions": [q.to_dict() for q in analysis.screening_questions[:3]],
            },
        )

    async def _navigate_to_apply(self, page) -> None:
        """Attempt to click apply button to reach application form.

        Args:
            page: Playwright page object
        """
        # Common apply button selectors
        apply_selectors = [
            # LinkedIn
            '[data-control-name="easy-apply-button"]',
            'button[aria-label*="Apply"]',
            # Indeed
            '[data-testid="indeedApply-button"]',
            'button[id="indeedApplyButton"]',
            # Generic
            'a[href*="apply"]',
            'button:has-text("Apply")',
            'a:has-text("Apply Now")',
            'button:has-text("Apply Now")',
            '[class*="apply-button"]',
            '[class*="apply_button"]',
        ]

        for selector in apply_selectors:
            try:
                button = await page.query_selector(selector)
                if button:
                    await button.click()
                    # Wait for navigation or new content
                    await page.wait_for_load_state("networkidle", timeout=5000)
                    logger.info(f"Clicked apply button: {selector}")
                    return
            except Exception:
                continue

        logger.debug("No apply button found or could not click")
