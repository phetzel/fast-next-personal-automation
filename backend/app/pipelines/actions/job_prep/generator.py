"""Job prep generator using PydanticAI.

Generates cover letters, prep notes, and screening answers for job applications.
"""

import logging
import re
from typing import Any

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.core.config import settings

logger = logging.getLogger(__name__)


class PrepOutput(BaseModel):
    """Output from the job prep generator."""

    cover_letter: str | None = Field(
        default=None,
        description=(
            "A tailored cover letter body (3-4 paragraphs, no greeting/closing/signature), "
            "or null when no cover letter should be generated"
        ),
    )
    prep_notes: str = Field(description="Markdown notes with resume highlights and talking points")
    screening_answers: dict[str, str] = Field(
        default_factory=dict,
        description="Generated answers for screening questions keyed by question text",
    )


class PrepDeps(BaseModel):
    """Dependencies for the job prep agent."""

    job_title: str
    company: str
    job_description: str
    resume_text: str
    story_content: str | None = None
    projects_content: list[str] | None = None
    screening_questions: list[str] | None = None
    reasoning: str | None = None
    application_type: str | None = None
    source: str | None = None
    tone: str = "professional"


class RewriteOutput(BaseModel):
    """Output for cover-letter rewrite pass."""

    cover_letter: str = Field(
        description="A more human-sounding cover-letter body with the same facts and no greeting/closing"
    )


_CLICHE_PATTERNS = (
    "excited about the opportunity",
    "stands out as a leader",
    "perfectly aligns",
    "strong addition to your team",
    "dynamic organization",
    "cutting-edge",
    "unwavering passion",
    "i am writing to express my interest",
)


def _normalize_screening_questions(questions: list[dict[str, Any]] | None) -> list[str]:
    """Extract readable screening-question text from mixed payloads."""
    if not questions:
        return []

    normalized: list[str] = []
    for question in questions:
        if isinstance(question, str):
            value = question.strip()
            if value:
                normalized.append(value)
            continue

        if not isinstance(question, dict):
            continue

        for key in ("question", "label", "prompt", "name", "text"):
            raw = question.get(key)
            if isinstance(raw, str) and raw.strip():
                normalized.append(raw.strip())
                break

    return normalized


def _paragraph_count(text: str) -> int:
    return len([part for part in re.split(r"\n\s*\n", text.strip()) if part.strip()])


def _needs_cover_letter_rewrite(text: str | None, company: str) -> bool:
    """Apply lightweight quality checks before spending on a rewrite pass."""
    if not text or not text.strip():
        return False

    lowered = text.lower()
    if any(pattern in lowered for pattern in _CLICHE_PATTERNS):
        return True

    if company and company.lower() not in lowered:
        return True

    paragraph_count = _paragraph_count(text)
    if paragraph_count < 3 or paragraph_count > 4:
        return True

    word_count = len(re.findall(r"\b\w+\b", text))
    return word_count < 140 or word_count > 380


def _create_prep_agent() -> Agent[PrepDeps, PrepOutput]:
    """Create the PydanticAI agent for job prep generation."""
    model = OpenAIChatModel(
        settings.AI_MODEL,
        provider=OpenAIProvider(api_key=settings.OPENAI_API_KEY),
    )

    agent: Agent[PrepDeps, PrepOutput] = Agent(
        model=model,
        output_type=PrepOutput,
        system_prompt=(
            "You are an expert career coach and professional writer who helps candidates "
            "prepare compelling job applications. Your goal is to create personalized, "
            "authentic materials that highlight the candidate's relevant experience without "
            "sounding robotic, formulaic, or over-polished.\n\n"
            "You MUST generate the requested outputs. Never return empty values. The only field "
            "that may be null is cover_letter when you are explicitly told not to write one.\n\n"
            "1. **cover_letter** (REQUIRED FIELD): Generate ONLY the body paragraphs of a "
            "cover letter, or return null when you are explicitly told not to write one.\n"
            "   CRITICAL FORMATTING RULES:\n"
            "   - DO NOT include any greeting (no 'Dear...', 'Hello', 'Hi', etc.)\n"
            "   - DO NOT include any closing (no 'Sincerely', 'Best regards', 'Thanks', etc.)\n"
            "   - DO NOT include any signature or name at the end\n"
            "   - DO NOT include any contact information (phone, email, address, website)\n"
            "   - Start directly with the first paragraph of content\n"
            "   - End with the final paragraph of content (no sign-off)\n"
            "   - Return null instead of placeholder text when a cover letter is not requested\n\n"
            "   CONTENT RULES:\n"
            "   - Use 3-4 short paragraphs\n"
            "   - Mention the company and role naturally\n"
            "   - Use 1-2 concrete examples from the candidate's real background\n"
            "   - Do not simply restate the resume line by line\n"
            "   - Avoid generic praise, career-coach filler, and hype language\n"
            "   - Do not invent facts about the company, product, team, or candidate\n"
            "   - Keep the voice direct, specific, and human\n"
            "   - Match the requested tone, but default to professional-conversational rather than stiff\n\n"
            "2. **prep_notes** (REQUIRED, in Markdown format): Preparation materials including:\n"
            "   - **Resume Highlights**: 3-5 bullet points of most relevant experiences\n"
            "   - **Talking Points**: 3-5 key points to emphasize in interviews\n"
            "   - **Skills Match**: How the candidate's skills align with requirements\n"
            "   - **Potential Questions**: 2-3 questions the interviewer might ask\n"
            "   - **Questions to Ask**: 2-3 thoughtful questions for the interviewer\n\n"
            "3. **screening_answers** (REQUIRED):\n"
            "   - Return a JSON object keyed by the exact screening question text\n"
            "   - Answer each question honestly and specifically from the candidate's background\n"
            "   - If there are no screening questions, return an empty object {}\n"
            "   - Screening questions should NOT change the cover-letter content; answer them separately\n\n"
            "Be specific and avoid generic phrases. Every point should connect to "
            "the actual job description and candidate's real experience."
        ),
    )

    @agent.system_prompt
    def add_candidate_context(ctx) -> str:
        """Add the candidate's background to the context."""
        context = (
            f"ROLE: {ctx.deps.job_title}\n"
            f"COMPANY: {ctx.deps.company}\n"
            f"TONE: {ctx.deps.tone}\n"
            f"APPLICATION TYPE: {ctx.deps.application_type or 'unknown'}\n"
            f"JOB SOURCE: {ctx.deps.source or 'unknown'}\n\n"
            f"CANDIDATE RESUME:\n{ctx.deps.resume_text}\n\n"
            f"JOB DESCRIPTION:\n{ctx.deps.job_description or 'No description provided.'}\n\n"
        )

        if ctx.deps.story_content:
            context += f"CANDIDATE'S PERSONAL STORY:\n{ctx.deps.story_content}\n\n"

        if ctx.deps.projects_content:
            context += "CANDIDATE'S PROJECTS:\n"
            for i, project in enumerate(ctx.deps.projects_content, 1):
                context += f"\n--- Project {i} ---\n{project}\n"
            context += "\n"

        if ctx.deps.reasoning:
            context += f"MATCH REASONING / FIT NOTES:\n{ctx.deps.reasoning}\n\n"

        if ctx.deps.screening_questions:
            context += "SCREENING QUESTIONS TO ANSWER:\n"
            for i, question in enumerate(ctx.deps.screening_questions, 1):
                context += f"{i}. {question}\n"
            context += "\n"
        else:
            context += "SCREENING QUESTIONS TO ANSWER:\nNone\n\n"

        return context

    return agent


def _create_rewrite_agent() -> Agent[PrepDeps, RewriteOutput]:
    """Create a lightweight rewrite agent used only when quality checks fail."""
    model = OpenAIChatModel(
        settings.AI_MODEL,
        provider=OpenAIProvider(api_key=settings.OPENAI_API_KEY),
    )

    agent: Agent[PrepDeps, RewriteOutput] = Agent(
        model=model,
        output_type=RewriteOutput,
        system_prompt=(
            "You rewrite cover letters to sound like a thoughtful human wrote them.\n"
            "Keep every factual claim grounded in the provided resume, projects, and story.\n"
            "Do not add a greeting, closing, signature, contact details, or invented facts.\n"
            "Use 3-4 short paragraphs, direct language, and concrete examples.\n"
            "Remove hype, filler, and cliché phrases."
        ),
    )

    @agent.system_prompt
    def add_candidate_context(ctx) -> str:
        return f"ROLE: {ctx.deps.job_title}\nCOMPANY: {ctx.deps.company}\nTONE: {ctx.deps.tone}\n"

    return agent


# Lazy initialization of the agent
_agent: Agent[PrepDeps, PrepOutput] | None = None
_rewrite_agent: Agent[PrepDeps, RewriteOutput] | None = None


def get_prep_agent() -> Agent[PrepDeps, PrepOutput]:
    """Get or create the prep agent singleton."""
    global _agent
    if _agent is None:
        _agent = _create_prep_agent()
    return _agent


def get_rewrite_agent() -> Agent[PrepDeps, RewriteOutput]:
    """Get or create the rewrite agent singleton."""
    global _rewrite_agent
    if _rewrite_agent is None:
        _rewrite_agent = _create_rewrite_agent()
    return _rewrite_agent


async def generate_prep_materials(
    job_title: str,
    company: str,
    job_description: str,
    resume_text: str,
    story_content: str | None = None,
    projects_content: list[str] | None = None,
    screening_questions: list[dict[str, Any]] | None = None,
    reasoning: str | None = None,
    application_type: str | None = None,
    source: str | None = None,
    tone: str = "professional",
    skip_cover_letter: bool = False,
) -> PrepOutput:
    """Generate cover letter and prep notes for a job.

    Args:
        job_title: Title of the job
        company: Company name
        job_description: Full job description
        resume_text: Candidate's resume text
        story_content: Optional personal story/narrative
        projects_content: Optional list of project descriptions
        screening_questions: Optional list of screening question payloads
        reasoning: Optional AI reasoning about the fit
        application_type: Optional application type
        source: Optional job source
        tone: Desired tone (professional, conversational, enthusiastic)
        skip_cover_letter: If True, only generate prep notes (cover letter not required)

    Returns:
        PrepOutput with cover_letter (optional) and prep_notes
    """
    agent = get_prep_agent()
    normalized_questions = _normalize_screening_questions(screening_questions)
    deps = PrepDeps(
        job_title=job_title,
        company=company,
        job_description=job_description,
        resume_text=resume_text,
        story_content=story_content,
        projects_content=projects_content,
        screening_questions=normalized_questions or None,
        reasoning=reasoning,
        application_type=application_type,
        source=source,
        tone=tone,
    )

    if skip_cover_letter:
        prompt = f"""
Generate prep materials for this job, but do not write a cover letter because one is not required.

**Position:** {job_title}
**Company:** {company}

**Job Description:**
{job_description or "No description available - focus on the job title and company."}

Please create comprehensive prep notes and answer any screening questions based on the candidate's background.
For the cover_letter field, return null.
"""
    else:
        prompt = f"""
Generate application materials for this job:

**Position:** {job_title}
**Company:** {company}

**Job Description:**
{job_description or "No description available - focus on the job title and company."}

Please create a tailored cover letter and comprehensive prep notes based on the candidate's background.
"""

    try:
        result = await agent.run(prompt, deps=deps)
        output = result.output

        if skip_cover_letter:
            output.cover_letter = None
        elif _needs_cover_letter_rewrite(output.cover_letter, company):
            rewrite_agent = get_rewrite_agent()
            rewrite_prompt = f"""
Rewrite this cover letter to sound more natural and specific without changing the underlying facts.

ROLE: {job_title}
COMPANY: {company}

ORIGINAL COVER LETTER:
{output.cover_letter}
"""
            try:
                rewrite_result = await rewrite_agent.run(rewrite_prompt, deps=deps)
                if rewrite_result.output.cover_letter.strip():
                    output = PrepOutput(
                        cover_letter=rewrite_result.output.cover_letter,
                        prep_notes=output.prep_notes,
                        screening_answers=output.screening_answers,
                    )
            except Exception as rewrite_error:
                logger.warning(
                    "Cover-letter rewrite pass failed for '%s' at %s: %s",
                    job_title,
                    company,
                    rewrite_error,
                )

        # Validate cover letter was actually generated (not empty)
        if not skip_cover_letter and (not output.cover_letter or not output.cover_letter.strip()):
            # AI returned empty cover letter when we expected one - use fallback
            logger.warning(
                f"AI returned empty cover letter for '{job_title}' at {company}, using fallback"
            )
            output = PrepOutput(
                cover_letter=(
                    f"I am excited to apply for the {job_title} position at {company}. "
                    f"With my background and experience, I am confident I would be a strong addition to your team.\n\n"
                    f"[AI generation returned empty. Please complete this cover letter manually or retry generation.]"
                ),
                prep_notes=output.prep_notes,
                screening_answers=output.screening_answers,
            )

        return output
    except Exception as e:
        logger.error(f"Error generating prep materials for '{job_title}' at {company}: {e}")
        # Return a basic template on error
        error_msg = str(e)[:100]
        return PrepOutput(
            cover_letter=(
                None
                if skip_cover_letter
                else f"I am writing to express my interest in the {job_title} position at {company}.\n\n[Generation failed: {error_msg}. Please complete this cover letter manually.]"
            ),
            prep_notes=f"# Prep Notes for {job_title} at {company}\n\n*Generation failed: {error_msg}*\n\n## Resume Highlights\n- [Add manually]\n\n## Talking Points\n- [Add manually]",
            screening_answers={},
        )
