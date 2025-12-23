"""Job analyzer using PydanticAI.

Analyzes job listings against a user's resume to score relevance.
"""

import asyncio
import logging
from typing import Any

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.core.config import settings
from app.pipelines.actions.job_search.scraper import ScrapedJob

logger = logging.getLogger(__name__)


class JobAnalysis(BaseModel):
    """Result of analyzing a job against a resume."""

    relevance_score: float = Field(
        ge=0.0,
        le=10.0,
        description="Score between 0.0 and 10.0 indicating job-resume fit",
    )
    reasoning: str = Field(
        description="Brief explanation of the score highlighting key matching/missing skills"
    )


class AnalyzerDeps(BaseModel):
    """Dependencies for the job analyzer agent."""

    resume_text: str
    target_roles: list[str] | None = None
    preferences: dict[str, Any] | None = None


def _create_analyzer_agent() -> Agent[AnalyzerDeps, JobAnalysis]:
    """Create the PydanticAI agent for job analysis."""
    model = OpenAIChatModel(
        settings.AI_MODEL,
        provider=OpenAIProvider(api_key=settings.OPENAI_API_KEY),
    )

    agent: Agent[AnalyzerDeps, JobAnalysis] = Agent(
        model=model,
        output_type=JobAnalysis,
        system_prompt=(
            "You are a career advisor who analyzes job fit. "
            "Your goal is to score how well a job matches a candidate's resume. "
            "Score from 0-10: "
            "- 8-10: Excellent fit, candidate is highly qualified "
            "- 6-7: Good fit with minor gaps "
            "- 4-5: Moderate fit, some key skills missing "
            "- 0-3: Poor fit, major gaps in requirements "
            "Be direct and specific. Focus on technical skills, experience level, and role alignment. "
            "Keep reasoning concise (2-3 sentences max)."
        ),
    )

    @agent.system_prompt
    def add_resume_context(ctx) -> str:
        """Add the user's resume to the context."""
        context = f"CANDIDATE RESUME:\n{ctx.deps.resume_text}"
        if ctx.deps.target_roles:
            context += f"\n\nTARGET ROLES: {', '.join(ctx.deps.target_roles)}"
        return context

    return agent


# Lazy initialization of the agent
_agent: Agent[AnalyzerDeps, JobAnalysis] | None = None


def get_analyzer_agent() -> Agent[AnalyzerDeps, JobAnalysis]:
    """Get or create the analyzer agent singleton."""
    global _agent
    if _agent is None:
        _agent = _create_analyzer_agent()
    return _agent


async def analyze_job(
    job: ScrapedJob,
    resume_text: str,
    target_roles: list[str] | None = None,
    preferences: dict[str, Any] | None = None,
) -> JobAnalysis:
    """Analyze a single job against the user's resume.

    Args:
        job: The scraped job to analyze
        resume_text: The user's resume text
        target_roles: Optional list of target job roles
        preferences: Optional additional preferences

    Returns:
        JobAnalysis with relevance score and reasoning
    """
    agent = get_analyzer_agent()
    deps = AnalyzerDeps(
        resume_text=resume_text,
        target_roles=target_roles,
        preferences=preferences,
    )

    prompt = f"""
Analyze this job opportunity:
Title: {job.title}
Company: {job.company}
Location: {job.location or 'Not specified'}
{f'Salary: {job.salary_range}' if job.salary_range else ''}

Description:
{job.description or 'No description available'}
"""

    try:
        result = await agent.run(prompt, deps=deps)
        return result.output
    except Exception as e:
        logger.error(f"Error analyzing job '{job.title}': {e}")
        # Return a neutral score on error
        return JobAnalysis(
            relevance_score=5.0,
            reasoning=f"Analysis failed: {str(e)[:100]}",
        )


async def analyze_jobs_batch(
    jobs: list[ScrapedJob],
    resume_text: str,
    target_roles: list[str] | None = None,
    preferences: dict[str, Any] | None = None,
    max_concurrent: int = 5,
) -> list[tuple[ScrapedJob, JobAnalysis]]:
    """Analyze multiple jobs concurrently.

    Args:
        jobs: List of jobs to analyze
        resume_text: The user's resume text
        target_roles: Optional list of target job roles
        preferences: Optional additional preferences
        max_concurrent: Maximum concurrent API calls

    Returns:
        List of (job, analysis) tuples
    """
    semaphore = asyncio.Semaphore(max_concurrent)

    async def analyze_with_semaphore(job: ScrapedJob) -> tuple[ScrapedJob, JobAnalysis]:
        async with semaphore:
            logger.info(f"Analyzing: {job.title} at {job.company}")
            analysis = await analyze_job(job, resume_text, target_roles, preferences)
            return (job, analysis)

    results = await asyncio.gather(
        *[analyze_with_semaphore(job) for job in jobs],
        return_exceptions=False,
    )

    return results

