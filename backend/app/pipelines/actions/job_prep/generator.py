"""Job prep generator using PydanticAI.

Generates cover letters and prep notes for job applications.
"""

import logging

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.core.config import settings

logger = logging.getLogger(__name__)


class PrepOutput(BaseModel):
    """Output from the job prep generator."""

    cover_letter: str = Field(description="A tailored cover letter for the job application")
    prep_notes: str = Field(description="Markdown notes with resume highlights and talking points")


class PrepDeps(BaseModel):
    """Dependencies for the job prep agent."""

    job_title: str
    company: str
    job_description: str
    resume_text: str
    story_content: str | None = None
    projects_content: list[str] | None = None
    tone: str = "professional"


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
            "authentic materials that highlight the candidate's relevant experience.\n\n"
            "You will generate two outputs:\n\n"
            "1. **Cover Letter**: A tailored cover letter that:\n"
            "   - Opens with a compelling hook related to the company/role\n"
            "   - Connects the candidate's experience directly to job requirements\n"
            "   - Incorporates their personal story naturally (if provided)\n"
            "   - References specific projects that demonstrate relevant skills\n"
            "   - Is concise (3-4 paragraphs max)\n"
            "   - Matches the requested tone (professional/conversational/enthusiastic)\n\n"
            "2. **Prep Notes** (in Markdown format): Preparation materials including:\n"
            "   - **Resume Highlights**: 3-5 bullet points of most relevant experiences\n"
            "   - **Talking Points**: 3-5 key points to emphasize in interviews\n"
            "   - **Skills Match**: How the candidate's skills align with requirements\n"
            "   - **Potential Questions**: 2-3 questions the interviewer might ask\n"
            "   - **Questions to Ask**: 2-3 thoughtful questions for the interviewer\n\n"
            "Be specific and avoid generic phrases. Every point should connect to "
            "the actual job description and candidate's real experience."
        ),
    )

    @agent.system_prompt
    def add_candidate_context(ctx) -> str:
        """Add the candidate's background to the context."""
        context = f"CANDIDATE RESUME:\n{ctx.deps.resume_text}\n\n"

        if ctx.deps.story_content:
            context += f"CANDIDATE'S PERSONAL STORY:\n{ctx.deps.story_content}\n\n"

        if ctx.deps.projects_content:
            context += "CANDIDATE'S PROJECTS:\n"
            for i, project in enumerate(ctx.deps.projects_content, 1):
                context += f"\n--- Project {i} ---\n{project}\n"
            context += "\n"

        context += f"TONE: {ctx.deps.tone}"
        return context

    return agent


# Lazy initialization of the agent
_agent: Agent[PrepDeps, PrepOutput] | None = None


def get_prep_agent() -> Agent[PrepDeps, PrepOutput]:
    """Get or create the prep agent singleton."""
    global _agent
    if _agent is None:
        _agent = _create_prep_agent()
    return _agent


async def generate_prep_materials(
    job_title: str,
    company: str,
    job_description: str,
    resume_text: str,
    story_content: str | None = None,
    projects_content: list[str] | None = None,
    tone: str = "professional",
) -> PrepOutput:
    """Generate cover letter and prep notes for a job.

    Args:
        job_title: Title of the job
        company: Company name
        job_description: Full job description
        resume_text: Candidate's resume text
        story_content: Optional personal story/narrative
        projects_content: Optional list of project descriptions
        tone: Desired tone (professional, conversational, enthusiastic)

    Returns:
        PrepOutput with cover_letter and prep_notes
    """
    agent = get_prep_agent()
    deps = PrepDeps(
        job_title=job_title,
        company=company,
        job_description=job_description,
        resume_text=resume_text,
        story_content=story_content,
        projects_content=projects_content,
        tone=tone,
    )

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
        return result.output
    except Exception as e:
        logger.error(f"Error generating prep materials for '{job_title}' at {company}: {e}")
        # Return a basic template on error
        return PrepOutput(
            cover_letter=f"[Generation failed: {str(e)[:100]}]\n\nDear Hiring Manager,\n\nI am writing to express my interest in the {job_title} position at {company}.\n\n[Please complete manually]",
            prep_notes=f"# Prep Notes for {job_title} at {company}\n\n*Generation failed: {str(e)[:100]}*\n\n## Resume Highlights\n- [Add manually]\n\n## Talking Points\n- [Add manually]",
        )
