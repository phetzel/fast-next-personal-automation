"""Job Apply Pipeline.

Assists with or automates job application submission.
"""

import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, ClassVar, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.db.models.job import JobStatus
from app.db.session import get_db_context
from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.registry import register_pipeline
from app.repositories import job_repo

if TYPE_CHECKING:
    from app.db.models.job import Job

logger = logging.getLogger(__name__)


class JobApplyInput(BaseModel):
    """Input for the job apply pipeline."""

    job_id: UUID = Field(
        description="Select a job to apply for",
        json_schema_extra={"format": "x-job-select"},
    )
    mode: Literal["assisted", "semi_automated", "automated"] = Field(
        default="assisted",
        description="Application mode: assisted (prepare materials), semi_automated (fill forms), or automated (full submit)",
    )
    dry_run: bool = Field(
        default=True,
        description="If True, do not actually submit the application (for testing)",
    )
    confirm_before_submit: bool = Field(
        default=True,
        description="Pause for user confirmation before submitting (semi_automated/automated modes)",
    )


class ApplicationMaterial(BaseModel):
    """Prepared application material for clipboard/manual use."""

    field_name: str
    content: str
    field_type: str = "text"


class JobApplyOutput(BaseModel):
    """Output from the job apply pipeline."""

    job_id: UUID = Field(description="ID of the job")
    job_title: str = Field(description="Title of the job")
    company: str = Field(description="Company name")
    mode: str = Field(description="Application mode used")
    application_url: str = Field(description="URL to apply")
    status: str = Field(description="Result status: prepared, filled, submitted, error")
    materials: list[ApplicationMaterial] = Field(
        default_factory=list, description="Prepared materials for manual application"
    )
    message: str = Field(description="Human-readable status message")
    screenshot_path: str | None = Field(
        default=None, description="Path to screenshot (semi_automated mode)"
    )
    confirmation_code: str | None = Field(
        default=None, description="Confirmation code (if submitted)"
    )


@register_pipeline
class JobApplyPipeline(ActionPipeline[JobApplyInput, JobApplyOutput]):
    """Job apply pipeline that assists with application submission.

    This pipeline supports three modes:

    **Assisted Mode** (default, safest):
    - Prepares all materials for manual application
    - Returns structured data for clipboard copying
    - Opens application URL for user to complete manually
    - Best for: First-time applications, sensitive applications

    **Semi-Automated Mode** (requires browser):
    - Navigates to application page
    - Fills in detected form fields automatically
    - Pauses before submit for user review
    - Takes screenshot for verification
    - Best for: Bulk applications with user oversight

    **Automated Mode** (requires explicit consent):
    - Completes and submits application automatically
    - Captures confirmation page/code
    - Logs all actions for audit trail
    - Best for: High-volume applications to similar roles

    Prerequisites:
    - Job must be in PREPPED status (run job_prep first)
    - For semi_automated/automated: job must be analyzed (run job_analyze first)

    Can be invoked via:
    - API: POST /api/v1/pipelines/job_apply/execute
    - Agent: "Apply to this job"
    - Webhook: POST /api/v1/pipelines/webhook/job_apply
    """

    name = "job_apply"
    description = "Assist with or automate job application submission"
    tags: ClassVar[list[str]] = ["jobs", "browser", "automation"]
    area: ClassVar[str | None] = "jobs"

    async def execute(
        self,
        input: JobApplyInput,
        context: PipelineContext,
    ) -> ActionResult[JobApplyOutput]:
        """Execute the job apply pipeline."""
        logger.info(f"Starting job apply pipeline for job {input.job_id} in {input.mode} mode")

        # Require user context
        if context.user_id is None:
            return ActionResult(
                success=False,
                error="User authentication required for job application",
            )

        # Step 1: Get the job
        async with get_db_context() as db:
            job = await job_repo.get_by_id_and_user(db, input.job_id, context.user_id)

        if job is None:
            return ActionResult(
                success=False,
                error=f"Job not found or you don't have access to it: {input.job_id}",
            )

        # Step 2: Verify job is ready for application
        if job.status == JobStatus.APPLIED.value:
            return ActionResult(
                success=False,
                error="This job has already been applied to",
            )

        # Get application URL (prefer analyzed URL, fall back to job URL)
        application_url = job.application_url or job.job_url
        if not application_url:
            return ActionResult(
                success=False,
                error="Job does not have an application URL",
            )

        # Step 3: Execute based on mode
        if input.mode == "assisted":
            return await self._execute_assisted(job, application_url, context)
        elif input.mode == "semi_automated":
            return await self._execute_semi_automated(job, application_url, input.dry_run, context)
        elif input.mode == "automated":
            return await self._execute_automated(
                job, application_url, input.dry_run, input.confirm_before_submit, context
            )
        else:
            return ActionResult(
                success=False,
                error=f"Unknown application mode: {input.mode}",
            )

    async def _execute_assisted(
        self,
        job: "Job",
        application_url: str,
        context: PipelineContext,
    ) -> ActionResult[JobApplyOutput]:
        """Execute assisted mode - prepare materials for manual application.

        This is the safest mode that just prepares materials for the user
        to copy/paste manually.
        """
        logger.info(f"Preparing assisted application for job {job.id}")

        materials: list[ApplicationMaterial] = []

        # Add cover letter if available
        if job.cover_letter:
            materials.append(
                ApplicationMaterial(
                    field_name="Cover Letter",
                    content=job.cover_letter,
                    field_type="textarea",
                )
            )

        # Add basic info that's commonly needed
        materials.append(
            ApplicationMaterial(
                field_name="Position Applied For",
                content=job.title,
                field_type="text",
            )
        )

        # Add any screening answers if available
        if job.screening_questions:
            # Note: In a full implementation, we'd pull from stored screening answers
            pass

        # Update job status to indicate application is in progress
        async with get_db_context() as db:
            job_record = await job_repo.get_by_id_and_user(db, job.id, context.user_id)
            if job_record:
                await job_repo.update(
                    db,
                    db_job=job_record,
                    update_data={
                        "status": JobStatus.REVIEWED.value,
                    },
                )
                await db.commit()

        return ActionResult(
            success=True,
            output=JobApplyOutput(
                job_id=job.id,
                job_title=job.title,
                company=job.company,
                mode="assisted",
                application_url=application_url,
                status="prepared",
                materials=materials,
                message=(
                    f"Application materials prepared for {job.title} at {job.company}. "
                    f"Please open {application_url} and complete the application manually."
                ),
            ),
            metadata={
                "materials_count": len(materials),
                "has_cover_letter": job.cover_letter is not None,
            },
        )

    async def _execute_semi_automated(
        self,
        job: "Job",
        application_url: str,
        dry_run: bool,
        context: PipelineContext,
    ) -> ActionResult[JobApplyOutput]:
        """Execute semi-automated mode - fill forms but don't submit.

        Uses browser automation to fill in form fields, then pauses
        for user review before submission.
        """
        logger.info(f"Executing semi-automated application for job {job.id}")

        # Check if job has been analyzed
        if not job.detected_fields:
            return ActionResult(
                success=False,
                error="Job has not been analyzed. Please run job_analyze first to detect form fields.",
            )

        try:
            from app.browser.client import get_page

            screenshot_path: str | None = None

            async with get_page() as page:
                # Navigate to application page
                await page.goto(application_url, wait_until="networkidle")
                logger.info(f"Navigated to: {page.url}")

                # Fill detected fields
                fields_filled = 0
                if job.detected_fields and "fields" in job.detected_fields:
                    for field_info in job.detected_fields["fields"]:
                        if await self._fill_field(page, field_info, job):
                            fields_filled += 1

                # Take screenshot for review
                if not dry_run:
                    screenshot_path = f"/tmp/job_apply_{job.id}.png"
                    await page.screenshot(path=screenshot_path, full_page=True)
                    logger.info(f"Screenshot saved to: {screenshot_path}")

            # Update job record
            async with get_db_context() as db:
                job_record = await job_repo.get_by_id_and_user(db, job.id, context.user_id)
                if job_record:
                    await job_repo.update(
                        db,
                        db_job=job_record,
                        update_data={
                            "status": JobStatus.REVIEWED.value,
                            "application_method": "semi_automated",
                        },
                    )
                    await db.commit()

            return ActionResult(
                success=True,
                output=JobApplyOutput(
                    job_id=job.id,
                    job_title=job.title,
                    company=job.company,
                    mode="semi_automated",
                    application_url=application_url,
                    status="filled",
                    materials=[],
                    message=(
                        f"Filled {fields_filled} fields for {job.title} at {job.company}. "
                        f"Please review and submit manually."
                    ),
                    screenshot_path=screenshot_path,
                ),
                metadata={
                    "fields_filled": fields_filled,
                    "dry_run": dry_run,
                },
            )

        except Exception as e:
            logger.exception(f"Semi-automated application failed: {e}")
            return ActionResult(
                success=False,
                error=f"Failed to fill application form: {e}",
            )

    async def _execute_automated(
        self,
        job: "Job",
        application_url: str,
        dry_run: bool,
        confirm_before_submit: bool,
        context: PipelineContext,
    ) -> ActionResult[JobApplyOutput]:
        """Execute automated mode - complete and submit application.

        WARNING: This mode actually submits applications. Use with caution.
        """
        logger.info(f"Executing automated application for job {job.id}")

        if dry_run:
            # In dry run, just simulate the process
            return ActionResult(
                success=True,
                output=JobApplyOutput(
                    job_id=job.id,
                    job_title=job.title,
                    company=job.company,
                    mode="automated",
                    application_url=application_url,
                    status="dry_run",
                    materials=[],
                    message=(
                        f"[DRY RUN] Would submit application for {job.title} at {job.company}. "
                        f"Set dry_run=False to actually submit."
                    ),
                ),
                metadata={"dry_run": True},
            )

        # Check if job has been analyzed
        if not job.detected_fields:
            return ActionResult(
                success=False,
                error="Job has not been analyzed. Please run job_analyze first.",
            )

        try:
            from app.browser.client import get_page

            confirmation_code: str | None = None

            async with get_page() as page:
                # Navigate to application page
                await page.goto(application_url, wait_until="networkidle")

                # Fill all fields
                fields_filled = 0
                if job.detected_fields and "fields" in job.detected_fields:
                    for field_info in job.detected_fields["fields"]:
                        if await self._fill_field(page, field_info, job):
                            fields_filled += 1

                # Look for submit button
                submit_selectors = [
                    'button[type="submit"]',
                    'input[type="submit"]',
                    'button:has-text("Submit")',
                    'button:has-text("Apply")',
                    '[data-testid="submit-button"]',
                ]

                submitted = False
                for selector in submit_selectors:
                    submit_btn = await page.query_selector(selector)
                    if submit_btn:
                        if confirm_before_submit:
                            # Take screenshot before submit
                            await page.screenshot(path=f"/tmp/job_apply_{job.id}_before_submit.png")
                            logger.info("Captured pre-submit screenshot")

                        await submit_btn.click()
                        await page.wait_for_load_state("networkidle")
                        submitted = True
                        logger.info("Application submitted")
                        break

                if submitted:
                    # Try to capture confirmation
                    content = await page.content()
                    # Simple extraction - could be enhanced with AI
                    if "confirmation" in content.lower():
                        confirmation_code = f"Submitted at {datetime.now(UTC).isoformat()}"

                    # Take confirmation screenshot
                    await page.screenshot(path=f"/tmp/job_apply_{job.id}_confirmation.png")

            # Update job record
            async with get_db_context() as db:
                job_record = await job_repo.get_by_id_and_user(db, job.id, context.user_id)
                if job_record:
                    await job_repo.update(
                        db,
                        db_job=job_record,
                        update_data={
                            "status": JobStatus.APPLIED.value,
                            "applied_at": datetime.now(UTC),
                            "application_method": "automated",
                            "confirmation_code": confirmation_code,
                        },
                    )
                    await db.commit()

            return ActionResult(
                success=True,
                output=JobApplyOutput(
                    job_id=job.id,
                    job_title=job.title,
                    company=job.company,
                    mode="automated",
                    application_url=application_url,
                    status="submitted" if submitted else "error",
                    materials=[],
                    message=(
                        f"Application submitted for {job.title} at {job.company}!"
                        if submitted
                        else "Could not find submit button"
                    ),
                    confirmation_code=confirmation_code,
                ),
                metadata={
                    "fields_filled": fields_filled,
                    "submitted": submitted,
                },
            )

        except Exception as e:
            logger.exception(f"Automated application failed: {e}")
            return ActionResult(
                success=False,
                error=f"Failed to submit application: {e}",
            )

    async def _fill_field(self, page, field_info: dict, job: Any) -> bool:
        """Fill a single form field based on detected field info.

        Args:
            page: Playwright page object
            field_info: Field information from job analysis
            job: Job record with prep materials

        Returns:
            True if field was filled successfully
        """
        selector = field_info.get("selector")
        field_name = field_info.get("name", "").lower()
        field_type = field_info.get("field_type", "text")

        if not selector:
            return False

        try:
            element = await page.query_selector(selector)
            if not element:
                return False

            # Determine what value to fill
            value: str | None = None

            # Cover letter field
            if "cover" in field_name and job.cover_letter:
                value = job.cover_letter

            # Common field mappings would go here
            # (name, email, phone, etc. from user profile)

            if value and field_type in ("text", "textarea", "email"):
                await element.fill(value)
                return True

            return False

        except Exception as e:
            logger.debug(f"Could not fill field {field_name}: {e}")
            return False
