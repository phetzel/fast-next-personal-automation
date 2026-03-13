"""Integration routes for external automation tools (e.g., OpenClaw)."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import (
    CurrentUser,
    DBSession,
    IntegrationTokenSvc,
    JobSvc,
    OpenClawAnalyzeToken,
    OpenClawApplyToken,
    OpenClawPrepToken,
    OpenClawToken,
)
from app.core.exceptions import ValidationError
from app.db.models.integration_token import IntegrationToken
from app.db.models.job import JobStatus
from app.pipelines.action_base import PipelineContext, PipelineSource
from app.pipelines.registry import execute_pipeline
from app.repositories import job_profile_repo
from app.schemas.integration import (
    OpenClawApplySuccessRequest,
    OpenClawJobAnalyzeRequest,
    OpenClawJobsIngestRequest,
    OpenClawJobsIngestResponse,
    OpenClawPrepBatchRequest,
    OpenClawTokenCreateRequest,
    OpenClawTokenCreateResponse,
    OpenClawTokenListResponse,
    OpenClawTokenRead,
)
from app.schemas.job import JobResponse
from app.schemas.job_data import RawJob
from app.schemas.pipeline import PipelineExecuteResponse

router = APIRouter()


def _token_to_read(token: IntegrationToken) -> OpenClawTokenRead:
    """Map token model to API response schema."""
    return OpenClawTokenRead(
        id=token.id,
        name=token.name,
        scopes=token.scopes,
        is_active=token.is_active,
        created_at=token.created_at,
        updated_at=token.updated_at,
        last_used_at=token.last_used_at,
        expires_at=token.expires_at,
    )


def _job_attributes_from_openclaw_payload(job) -> dict:
    """Map optional OpenClaw enrichment fields onto persisted job attributes."""
    attributes: dict = {}
    if job.description is not None:
        attributes["description"] = job.description
    if job.has_application_analysis:
        attributes.update(
            {
                "application_type": job.application_type,
                "application_url": job.application_url,
                "requires_cover_letter": job.requires_cover_letter,
                "requires_resume": job.requires_resume,
                "detected_fields": job.detected_fields,
                "screening_questions": job.screening_questions,
                "analyzed_at": job.analyzed_at or datetime.now(UTC),
                "status": JobStatus.ANALYZED.value,
            }
        )
    return attributes


@router.post(
    "/openclaw/tokens",
    response_model=OpenClawTokenCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_openclaw_token(
    payload: OpenClawTokenCreateRequest,
    current_user: CurrentUser,
    token_service: IntegrationTokenSvc,
    db: DBSession,
) -> OpenClawTokenCreateResponse:
    """Create a scoped OpenClaw integration token for the current user."""
    token, plaintext_token = await token_service.create_openclaw_token(
        user_id=current_user.id,
        name=payload.name,
        scopes=payload.scopes,
        expires_at=payload.expires_at,
    )
    await db.commit()

    return OpenClawTokenCreateResponse(
        token=plaintext_token,
        token_info=_token_to_read(token),
    )


@router.get("/openclaw/tokens", response_model=OpenClawTokenListResponse)
async def list_openclaw_tokens(
    current_user: CurrentUser,
    token_service: IntegrationTokenSvc,
) -> OpenClawTokenListResponse:
    """List OpenClaw tokens for the current user."""
    tokens = await token_service.list_tokens_for_user(current_user.id)
    return OpenClawTokenListResponse(items=[_token_to_read(t) for t in tokens], total=len(tokens))


@router.delete("/openclaw/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_openclaw_token(
    token_id: UUID,
    current_user: CurrentUser,
    token_service: IntegrationTokenSvc,
    db: DBSession,
) -> None:
    """Revoke one OpenClaw token."""
    await token_service.revoke_token_for_user(token_id, current_user.id)
    await db.commit()


@router.post("/openclaw/jobs/ingest", response_model=OpenClawJobsIngestResponse)
async def ingest_openclaw_jobs(
    payload: OpenClawJobsIngestRequest,
    openclaw_token: OpenClawToken,
    db: DBSession,
    job_service: JobSvc,
) -> OpenClawJobsIngestResponse:
    """Ingest jobs from OpenClaw into the current user's job list."""
    user_id = openclaw_token.user_id

    profile = None
    resume_text: str | None = None
    target_roles: list[str] | None = None
    preferences: dict | None = None
    analysis_enabled = False
    min_score = payload.min_score if payload.min_score is not None else 7.0
    external_analysis_by_url = {
        job.job_url: {
            "relevance_score": job.relevance_score,
            "reasoning": job.reasoning,
        }
        for job in payload.jobs
        if job.relevance_score is not None
    }
    external_analysis_used = bool(external_analysis_by_url)
    job_attributes_by_url = {}
    for job in payload.jobs:
        attributes = _job_attributes_from_openclaw_payload(job)
        if attributes:
            job_attributes_by_url[job.job_url] = attributes

    if payload.analyze_with_profile:
        if payload.profile_id:
            profile = await job_profile_repo.get_by_id(db, payload.profile_id)
            if profile is None or profile.user_id != user_id:
                raise ValidationError(message="Profile not found or access denied")
            if not profile.resume or not profile.resume.text_content:
                raise ValidationError(
                    message="Selected profile has no resume text for analysis",
                    details={"profile_id": str(profile.id)},
                )
        else:
            profile = await job_profile_repo.get_default_for_user(db, user_id)

        if profile and profile.resume and profile.resume.text_content:
            resume_text = profile.resume.text_content
            target_roles = profile.target_roles
            preferences = profile.preferences
            analysis_enabled = True
            if payload.min_score is None:
                min_score = profile.min_score_threshold or 7.0

    if payload.qa_with_internal_analysis and not resume_text:
        raise ValidationError(
            message="QA analysis requested but no profile resume text is available"
        )

    raw_jobs = [
        RawJob(
            title=job.title,
            company=job.company,
            job_url=job.job_url,
            location=job.location,
            description=job.description,
            salary_range=job.salary_range,
            date_posted=job.date_posted,
            source=job.source,
            is_remote=job.is_remote,
            job_type=job.job_type,
            company_url=job.company_url,
        )
        for job in payload.jobs
    ]

    ingestion = await job_service.ingest_jobs(
        user_id=user_id,
        jobs=raw_jobs,
        ingestion_source="openclaw",
        profile_id=profile.id if profile else None,
        resume_text=resume_text,
        target_roles=target_roles,
        preferences=preferences,
        min_score=min_score,
        save_all=payload.save_all,
        search_terms=payload.search_terms,
        external_analysis_by_url=external_analysis_by_url,
        job_attributes_by_url=job_attributes_by_url,
        qa_with_internal_analysis=payload.qa_with_internal_analysis,
    )
    await db.commit()

    return OpenClawJobsIngestResponse(
        jobs_received=ingestion.jobs_received,
        jobs_analyzed=ingestion.jobs_analyzed,
        jobs_saved=ingestion.jobs_saved,
        duplicates_skipped=ingestion.duplicates_skipped,
        high_scoring=ingestion.high_scoring,
        analysis_enabled=analysis_enabled,
        external_analysis_used=external_analysis_used,
        qa_with_internal_analysis=payload.qa_with_internal_analysis,
        qa_jobs_checked=ingestion.qa_jobs_checked,
        qa_large_score_drift=ingestion.qa_large_score_drift,
        profile_id=profile.id if profile else None,
        profile_name=profile.name if profile else None,
        token_id=openclaw_token.id,
        token_name=openclaw_token.name,
    )


@router.post("/openclaw/jobs/{job_id}/analyze", response_model=JobResponse)
async def analyze_openclaw_job(
    job_id: UUID,
    payload: OpenClawJobAnalyzeRequest,
    openclaw_token: OpenClawAnalyzeToken,
    job_service: JobSvc,
) -> JobResponse:
    """Persist application-page analysis for an existing job."""
    job = await job_service.update_application_analysis(
        job_id,
        openclaw_token.user_id,
        description=payload.description,
        application_type=payload.application_type,
        application_url=payload.application_url,
        requires_cover_letter=payload.requires_cover_letter,
        requires_resume=payload.requires_resume,
        detected_fields=payload.detected_fields,
        screening_questions=payload.screening_questions,
        analyzed_at=payload.analyzed_at,
    )
    return JobResponse.model_validate(job)


@router.post("/openclaw/jobs/prep-batch", response_model=PipelineExecuteResponse)
async def prep_openclaw_jobs(
    payload: OpenClawPrepBatchRequest,
    openclaw_token: OpenClawPrepToken,
    db: DBSession,
) -> PipelineExecuteResponse:
    """Trigger the internal analyzed-job prep batch pipeline for this user."""
    context = PipelineContext(
        source=PipelineSource.API,
        user_id=openclaw_token.user_id,
        metadata={
            "integration": "openclaw",
            "token_id": str(openclaw_token.id),
            "token_name": openclaw_token.name,
        },
    )
    result = await execute_pipeline(
        "job_prep_batch",
        {
            "job_ids": [str(job_id) for job_id in payload.job_ids] if payload.job_ids else None,
            "max_jobs": payload.max_jobs,
            "tone": payload.tone,
        },
        context,
        db=db,
    )
    return PipelineExecuteResponse(
        success=result.success,
        output=result.output.model_dump(mode="json") if result.output else None,
        error=result.error,
        metadata=result.metadata,
    )


@router.post("/openclaw/jobs/{job_id}/apply-success", response_model=JobResponse)
async def mark_openclaw_apply_success(
    job_id: UUID,
    payload: OpenClawApplySuccessRequest,
    openclaw_token: OpenClawApplyToken,
    job_service: JobSvc,
) -> JobResponse:
    """Record that OpenClaw successfully submitted an application."""
    job = await job_service.mark_job_applied(
        job_id,
        openclaw_token.user_id,
        applied_at=payload.applied_at,
        application_method=payload.application_method or "openclaw",
        confirmation_code=payload.confirmation_code,
        notes=payload.notes,
    )
    return JobResponse.model_validate(job)
