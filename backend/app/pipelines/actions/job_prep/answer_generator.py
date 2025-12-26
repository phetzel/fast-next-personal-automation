"""Screening answer generator using PydanticAI.

Generates answers for common job application screening questions.
"""

import logging
from typing import Any

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.core.config import settings

logger = logging.getLogger(__name__)


class ScreeningAnswerOutput(BaseModel):
    """Output from the screening answer generator."""

    answers: dict[str, str] = Field(description="Mapping of question text to generated answer")


class ScreeningAnswerDeps(BaseModel):
    """Dependencies for the screening answer agent."""

    resume_text: str
    job_title: str
    company: str
    questions: list[dict[str, Any]]


def _create_answer_agent() -> Agent[ScreeningAnswerDeps, ScreeningAnswerOutput]:
    """Create the PydanticAI agent for screening answer generation."""
    model = OpenAIChatModel(
        settings.AI_MODEL,
        provider=OpenAIProvider(api_key=settings.OPENAI_API_KEY),
    )

    agent: Agent[ScreeningAnswerDeps, ScreeningAnswerOutput] = Agent(
        model=model,
        output_type=ScreeningAnswerOutput,
        system_prompt=(
            "You are an expert career coach helping job candidates answer application "
            "screening questions. Your answers should be:\n\n"
            "1. **Honest**: Based on the candidate's actual resume and experience\n"
            "2. **Concise**: Direct answers, typically 1-3 sentences for text questions\n"
            "3. **Professional**: Appropriate tone for job applications\n"
            "4. **Specific**: Reference actual experience when relevant\n\n"
            "For yes/no questions, just answer 'Yes' or 'No' with a brief explanation.\n"
            "For numeric questions (years of experience), provide the number.\n"
            "For work authorization questions, if unclear from resume, suggest the candidate verify.\n\n"
            "If you cannot determine an answer from the resume, indicate that the "
            "candidate should provide this information manually."
        ),
    )

    @agent.system_prompt
    def add_context(ctx) -> str:
        """Add the candidate's background to the context."""
        return f"CANDIDATE RESUME:\n{ctx.deps.resume_text}"

    return agent


# Lazy initialization of the agent
_answer_agent: Agent[ScreeningAnswerDeps, ScreeningAnswerOutput] | None = None


def get_answer_agent() -> Agent[ScreeningAnswerDeps, ScreeningAnswerOutput]:
    """Get or create the answer agent singleton."""
    global _answer_agent
    if _answer_agent is None:
        _answer_agent = _create_answer_agent()
    return _answer_agent


async def generate_screening_answers(
    questions: list[dict[str, Any]],
    resume_text: str,
    job_title: str,
    company: str,
) -> dict[str, str]:
    """Generate answers for screening questions.

    Args:
        questions: List of screening questions from job analysis
        resume_text: Candidate's resume text
        job_title: Title of the job
        company: Company name

    Returns:
        Dictionary mapping question text to generated answer
    """
    if not questions:
        return {}

    agent = get_answer_agent()
    deps = ScreeningAnswerDeps(
        resume_text=resume_text,
        job_title=job_title,
        company=company,
        questions=questions,
    )

    # Format questions for the prompt
    questions_text = "\n".join(f"{i + 1}. {q.get('question', q)}" for i, q in enumerate(questions))

    prompt = f"""
Please answer these screening questions for a {job_title} position at {company}:

{questions_text}

Provide appropriate answers based on the candidate's resume. For each question,
give a professional, honest answer that reflects their actual experience.
"""

    try:
        result = await agent.run(prompt, deps=deps)
        return result.output.answers
    except Exception as e:
        logger.error(f"Error generating screening answers: {e}")
        # Return empty dict on error - caller can handle gracefully
        return {}


# Common screening question patterns and default handlers
COMMON_QUESTION_PATTERNS = {
    "work_authorization": [
        "authorized to work",
        "legally authorized",
        "work permit",
        "visa sponsorship",
    ],
    "years_experience": [
        "years of experience",
        "how many years",
        "experience with",
    ],
    "relocation": [
        "willing to relocate",
        "open to relocation",
    ],
    "start_date": [
        "start date",
        "when can you start",
        "earliest start",
    ],
    "salary": [
        "salary expectation",
        "compensation expectation",
        "desired salary",
    ],
    "remote_work": [
        "work remotely",
        "remote work",
        "hybrid",
        "on-site",
    ],
}


def categorize_question(question: str) -> str | None:
    """Categorize a screening question by type.

    Args:
        question: The question text

    Returns:
        Category name or None if not categorized
    """
    question_lower = question.lower()

    for category, patterns in COMMON_QUESTION_PATTERNS.items():
        for pattern in patterns:
            if pattern in question_lower:
                return category

    return None
