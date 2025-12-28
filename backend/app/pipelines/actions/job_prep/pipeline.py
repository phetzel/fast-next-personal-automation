"""Job Prep Pipeline.

Generates tailored cover letter and prep notes for a specific job.
"""

import logging
from datetime import UTC, datetime
from typing import ClassVar, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.cover_letter_pdf import (
    ContactInfo,
    generate_cover_letter_filename,
    generate_cover_letter_pdf,
)
from app.core.storage import get_storage_instance
from app.db.models.job import JobStatus
from app.db.session import get_db_context
from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.actions.job_prep.generator import generate_prep_materials
from app.pipelines.registry import register_pipeline
from app.repositories import job_profile_repo, job_repo, project_repo, user_repo
from app.schemas.job_profile import JobProfileSummary, ProfileRequiredError

logger = logging.getLogger(__name__)


class JobPrepInput(BaseModel):
    """Input for the job prep pipeline."""

    job_id: UUID = Field(
        description="Select a job to prepare application materials for",
        json_schema_extra={"format": "x-job-select"},
    )
    profile_id: UUID | None = Field(
        default=None,
        description="Job profile to use for resume. Uses default profile if not specified.",
        json_schema_extra={"format": "x-profile-select"},
    )
    tone: Literal["professional", "conversational", "enthusiastic"] = Field(
        default="professional",
        description="Tone for the cover letter",
    )
    generate_screening_answers: bool = Field(
        default=False,
        description="Generate answers for detected screening questions (requires prior analysis)",
    )
    auto_analyze: bool = Field(
        default=False,
        description="Analyze job application page first (for detecting form fields, not needed for cover letter)",
    )


class JobPrepOutput(BaseModel):
    """Output from the job prep pipeline."""

    job_id: UUID = Field(description="ID of the job that was prepped")
    job_title: str = Field(description="Title of the job")
    company: str = Field(description="Company name")
    cover_letter: str | None = Field(
        default=None, description="Generated cover letter (None if not required)"
    )
    prep_notes: str = Field(description="Markdown prep notes with highlights and talking points")
    profile_used: str = Field(description="Name of the profile used")
    included_story: bool = Field(description="Whether a story was included")
    included_projects: int = Field(description="Number of projects included")
    skipped_cover_letter: bool = Field(
        default=False, description="Whether cover letter was skipped (not required)"
    )
    screening_answers: dict[str, str] = Field(
        default_factory=dict, description="Generated answers for screening questions"
    )


@register_pipeline
class JobPrepPipeline(ActionPipeline[JobPrepInput, JobPrepOutput]):
    """Job prep pipeline that generates cover letter and prep notes.

    This pipeline:
    1. Fetches the job details by ID
    2. Auto-runs job_analyze if not already analyzed (detects cover letter requirement)
    3. Gets the user's resume from their selected profile
    4. Includes the profile's linked story and projects (if any)
    5. Generates a tailored cover letter and prep notes using AI
       (skips cover letter if analysis shows it's not required)
    6. Generates answers for screening questions (if detected during analysis)
    7. Saves the materials to the job record
    8. Updates the job status to PREPPED

    Prerequisites:
    - Job must exist and belong to the user
    - User must have a profile with a resume linked
    - Story and projects are optional (linked to profile)

    Can be invoked via:
    - API: POST /api/v1/pipelines/job_prep/execute
    - Agent: "Prepare materials for this job"
    - Webhook: POST /api/v1/pipelines/webhook/job_prep
    """

    name = "job_prep"
    description = "Generate cover letter and prep notes for a job application"
    tags: ClassVar[list[str]] = ["jobs", "ai", "writing"]
    area: ClassVar[str | None] = "jobs"

    async def execute(
        self,
        input: JobPrepInput,
        context: PipelineContext,
    ) -> ActionResult[JobPrepOutput]:
        """Execute the job prep pipeline."""
        logger.info(f"Starting job prep pipeline for job {input.job_id}")

        # Require user context
        if context.user_id is None:
            return ActionResult(
                success=False,
                error="User authentication required for job prep",
            )

        # Step 1: Get the job
        async with get_db_context() as db:
            job = await job_repo.get_by_id_and_user(db, input.job_id, context.user_id)

        if job is None:
            return ActionResult(
                success=False,
                error=f"Job not found or you don't have access to it: {input.job_id}",
            )

        # Step 1.5: Auto-analyze if not already analyzed
        if input.auto_analyze and job.analyzed_at is None:
            logger.info("Job not analyzed yet, running job_analyze first...")
            from app.pipelines.actions.job_analyze.pipeline import (
                JobAnalyzeInput,
                JobAnalyzePipeline,
            )

            analyze_input = JobAnalyzeInput(
                job_id=input.job_id,
                use_ai=False,  # Use fast DOM analysis by default
                navigate_to_apply=True,
            )
            analyze_pipeline = JobAnalyzePipeline()
            analyze_result = await analyze_pipeline.execute(analyze_input, context)

            if not analyze_result.success:
                logger.warning(f"Auto-analyze failed: {analyze_result.error}")
                # Continue anyway - prep can still work without analysis
            else:
                logger.info("Auto-analyze completed successfully")
                # Refresh job to get updated analysis fields
                async with get_db_context() as db:
                    job = await job_repo.get_by_id_and_user(db, input.job_id, context.user_id)
                    if job is None:
                        return ActionResult(
                            success=False,
                            error="Job was deleted during analysis",
                        )

        # Step 2: Get the profile
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
                        message="The selected profile was not found or you don't have access to it.",
                        available_profiles=available_profiles,
                    )
                    return ActionResult(
                        success=False,
                        error=error_data.model_dump_json(),
                        metadata={"error_type": "profile_required"},
                    )
            else:
                profile = await job_profile_repo.get_default_for_user(db, context.user_id)

        # Handle no profile case
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
                    message="No default profile set. Please select a profile to use for job prep.",
                    available_profiles=available_profiles,
                )
            else:
                error_data = ProfileRequiredError(
                    message="No job profiles found. Please create a profile before preparing for jobs.",
                    available_profiles=[],
                )
            return ActionResult(
                success=False,
                error=error_data.model_dump_json(),
                metadata={"error_type": "profile_required"},
            )

        # Verify resume exists
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

        # Step 3: Get story and projects from the profile
        story_content: str | None = None
        projects_content: list[str] = []

        # Get story linked to profile (already loaded via relationship)
        if profile.story:
            story_content = profile.story.content
            logger.info(f"Including profile story: {profile.story.name}")

        # Get projects linked to profile via project_ids
        if profile.project_ids:
            async with get_db_context() as db:
                project_uuids = [UUID(pid) for pid in profile.project_ids]
                projects = await project_repo.get_by_ids(db, project_uuids)
                for project in projects:
                    if project.text_content:
                        projects_content.append(project.text_content)
                if projects_content:
                    logger.info(f"Including {len(projects_content)} projects from profile")

        # Step 4: Always generate cover letter
        # We always generate a cover letter - it's useful to have even if not strictly required
        should_generate_cover_letter = True
        skipped_cover_letter = False
        logger.info("Generating cover letter (always enabled)")

        # Step 5: Generate materials
        logger.info(f"Generating prep materials for: {job.title} at {job.company}")
        try:
            prep_output = await generate_prep_materials(
                job_title=job.title,
                company=job.company,
                job_description=job.description or "",
                resume_text=resume_text,
                story_content=story_content,
                projects_content=projects_content if projects_content else None,
                tone=input.tone,
                skip_cover_letter=not should_generate_cover_letter,
            )
        except Exception as e:
            logger.exception("Failed to generate prep materials")
            return ActionResult(
                success=False,
                error=f"Failed to generate prep materials: {e}",
            )

        # Step 6: Generate screening answers if requested
        screening_answers: dict[str, str] = {}
        if input.generate_screening_answers and job.screening_questions:
            try:
                from app.pipelines.actions.job_prep.answer_generator import (
                    generate_screening_answers,
                )

                screening_answers = await generate_screening_answers(
                    questions=job.screening_questions,
                    resume_text=resume_text,
                    job_title=job.title,
                    company=job.company,
                )
                logger.info(f"Generated {len(screening_answers)} screening answers")
            except Exception as e:
                logger.warning(f"Failed to generate screening answers: {e}")
                # Continue without screening answers

        # Step 7: Update the job record
        async with get_db_context() as db:
            job = await job_repo.get_by_id_and_user(db, input.job_id, context.user_id)
            if job:
                update_data = {
                    "prep_notes": prep_output.prep_notes,
                    "prepped_at": datetime.now(UTC),
                    "status": JobStatus.PREPPED.value,
                }
                # Only update cover letter if we generated one
                if prep_output.cover_letter:
                    update_data["cover_letter"] = prep_output.cover_letter

                await job_repo.update(db, db_job=job, update_data=update_data)
                await db.commit()
                logger.info(f"Updated job {job.id} with prep materials, status set to PREPPED")

        # Step 8: Generate and store PDF if we have a cover letter
        cover_letter_file_path: str | None = None
        if prep_output.cover_letter:
            try:
                # Get user for contact info fallback
                async with get_db_context() as db:
                    user = await user_repo.get_by_id(db, context.user_id)

                if user:
                    # Build contact info from profile with fallbacks
                    contact_info = ContactInfo(
                        full_name=(
                            profile.contact_full_name
                            or user.full_name
                            or user.email.split("@")[0].replace("_", " ").replace(".", " ").title()
                        ),
                        phone=profile.contact_phone,
                        email=profile.contact_email or user.email,
                        location=profile.contact_location,
                        website=profile.contact_website,
                    )

                    # Generate PDF
                    pdf_bytes = generate_cover_letter_pdf(
                        cover_letter_text=prep_output.cover_letter,
                        contact_info=contact_info,
                        company_name=job.company,
                        job_title=job.title,
                    )

                    # Generate filename
                    filename = generate_cover_letter_filename(
                        company=job.company,
                        job_title=job.title,
                        applicant_name=contact_info.full_name,
                    )

                    # Store in S3
                    storage = await get_storage_instance()
                    cover_letter_file_path = await storage.save(
                        file_data=pdf_bytes,
                        user_id=context.user_id,
                        filename=filename,
                        subdir="cover_letters",
                    )

                    # Update job with PDF path
                    async with get_db_context() as db:
                        job = await job_repo.get_by_id_and_user(db, input.job_id, context.user_id)
                        if job:
                            await job_repo.update(
                                db,
                                db_job=job,
                                update_data={
                                    "cover_letter_file_path": cover_letter_file_path,
                                    "cover_letter_generated_at": datetime.now(UTC),
                                },
                            )
                            await db.commit()

                    logger.info(f"Generated cover letter PDF: {cover_letter_file_path}")

            except Exception as e:
                # PDF generation is not critical - log and continue
                logger.warning(f"Failed to generate cover letter PDF: {e}")

        return ActionResult(
            success=True,
            output=JobPrepOutput(
                job_id=input.job_id,
                job_title=job.title,
                company=job.company,
                cover_letter=prep_output.cover_letter,
                prep_notes=prep_output.prep_notes,
                profile_used=profile.name,
                included_story=story_content is not None,
                included_projects=len(projects_content),
                skipped_cover_letter=skipped_cover_letter,
                screening_answers=screening_answers,
            ),
            metadata={
                "profile_name": profile.name,
                "tone": input.tone,
                "had_story": story_content is not None,
                "project_count": len(projects_content),
                "skipped_cover_letter": skipped_cover_letter,
                "screening_answers_count": len(screening_answers),
            },
        )
