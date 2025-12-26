"""Job Prep Pipeline.

Generates tailored cover letter and prep notes for a specific job.
"""

import logging
from datetime import UTC, datetime
from typing import ClassVar, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.db.models.job import JobStatus
from app.db.session import get_db_context
from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.actions.job_prep.generator import generate_prep_materials
from app.pipelines.registry import register_pipeline
from app.repositories import job_profile_repo, job_repo, project_repo
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
    force_cover_letter: bool = Field(
        default=False,
        description="Generate cover letter even if analysis shows it's not required",
    )
    generate_screening_answers: bool = Field(
        default=True,
        description="Generate answers for detected screening questions",
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
    2. Gets the user's resume from their selected profile
    3. Includes the profile's linked story and projects (if any)
    4. Generates a tailored cover letter and prep notes using AI
    5. Saves the materials to the job record
    6. Updates the job status to PREPPED

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

        # Step 4: Determine if cover letter is needed
        # Check job analysis results (if job was analyzed)
        should_generate_cover_letter = True
        skipped_cover_letter = False

        if job.requires_cover_letter is False and not input.force_cover_letter:
            # Analysis indicates cover letter not required
            should_generate_cover_letter = False
            skipped_cover_letter = True
            logger.info("Skipping cover letter generation (not required per analysis)")
        elif job.requires_cover_letter is None:
            # No analysis done, generate by default
            logger.info("Cover letter requirement unknown, generating by default")

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
