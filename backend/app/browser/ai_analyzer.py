"""AI-powered browser analysis using browser-use.

Provides intelligent page analysis capabilities using LLMs to understand
complex or dynamic job application pages that may be difficult to parse
with traditional DOM inspection.
"""

import logging
from dataclasses import dataclass

from pydantic import BaseModel, Field

from app.browser.extractors import ApplicationAnalysis, ApplicationType
from app.core.config import settings

logger = logging.getLogger(__name__)


class AIAnalysisResult(BaseModel):
    """Structured result from AI analysis of a job application page."""

    application_type: str = Field(
        description="Type of application: easy_apply, ats, direct, email, or unknown"
    )
    requires_cover_letter: bool = Field(
        description="Whether a cover letter is required for this application"
    )
    requires_resume: bool = Field(default=True, description="Whether a resume upload is required")
    cover_letter_optional: bool = Field(
        default=False, description="Whether cover letter is optional but recommended"
    )
    estimated_fields_count: int = Field(description="Estimated number of form fields to fill")
    has_screening_questions: bool = Field(
        description="Whether there are screening questions to answer"
    )
    screening_questions: list[str] = Field(
        default_factory=list, description="List of detected screening questions"
    )
    application_url: str = Field(description="The URL where the actual application form is located")
    notes: str = Field(default="", description="Additional notes about the application process")


@dataclass
class AIPageAnalyzer:
    """AI-powered page analyzer using browser-use.

    This analyzer uses LLMs to understand complex application pages
    that may be difficult to parse with simple DOM inspection.
    """

    task_prompt: str = """
    Analyze this job application page and identify:

    1. What type of application is this?
       - easy_apply: LinkedIn/Indeed one-click apply
       - ats: An ATS system (Greenhouse, Lever, Workday, etc.)
       - direct: Company's own application form
       - email: Email-based application
       - unknown: Cannot determine

    2. Is a cover letter required, optional, or not mentioned?

    3. Is a resume upload required?

    4. How many form fields need to be filled out?

    5. Are there screening questions? If so, list them.

    6. What is the URL for the actual application form?
       (This may be different from the job posting URL)

    Return your analysis in a structured format.
    """

    async def analyze_page(self, job_url: str) -> ApplicationAnalysis:
        """Analyze a job application page using AI.

        Uses browser-use to navigate and understand the page content,
        then returns structured analysis results.

        Args:
            job_url: URL of the job posting to analyze

        Returns:
            ApplicationAnalysis with AI-detected information
        """
        try:
            # Import browser-use dynamically to handle import errors gracefully
            from browser_use import Agent
            from langchain_openai import ChatOpenAI

            # Create the LLM
            llm = ChatOpenAI(
                model=settings.BROWSER_USE_AI_MODEL,
                api_key=settings.OPENAI_API_KEY,
            )

            # Create the browser-use agent
            agent = Agent(
                task=f"""
                Navigate to {job_url} and analyze the job application.

                {self.task_prompt}

                Important:
                - If there's an "Apply" button, click it to see the application form
                - Look for cover letter upload fields or text areas
                - Note any screening questions like "Are you authorized to work..."
                - Find the actual application URL (it may redirect to an ATS)
                """,
                llm=llm,
            )

            # Run the agent
            result = await agent.run()

            # Parse the result into our structured format
            analysis = self._parse_agent_result(result, job_url)
            return analysis

        except ImportError as e:
            logger.warning(f"browser-use not available: {e}")
            # Fall back to basic analysis
            return ApplicationAnalysis(
                application_type=ApplicationType.UNKNOWN,
                application_url=job_url,
                requires_cover_letter=False,
                requires_resume=True,
            )
        except Exception as e:
            logger.exception(f"AI analysis failed for {job_url}: {e}")
            # Return basic analysis on error
            return ApplicationAnalysis(
                application_type=ApplicationType.UNKNOWN,
                application_url=job_url,
                requires_cover_letter=False,
                requires_resume=True,
            )

    def _parse_agent_result(self, result: str, original_url: str) -> ApplicationAnalysis:
        """Parse the agent's text result into structured ApplicationAnalysis.

        Args:
            result: Text output from the browser-use agent
            original_url: Original job URL

        Returns:
            ApplicationAnalysis with parsed information
        """
        result_lower = result.lower() if result else ""

        # Detect application type
        app_type = ApplicationType.UNKNOWN
        if "easy apply" in result_lower or "easy_apply" in result_lower:
            app_type = ApplicationType.EASY_APPLY
        elif any(ats in result_lower for ats in ["greenhouse", "lever", "workday", "icims", "ats"]):
            app_type = ApplicationType.ATS
        elif "direct" in result_lower or "company form" in result_lower:
            app_type = ApplicationType.DIRECT
        elif "email" in result_lower and "apply" in result_lower:
            app_type = ApplicationType.EMAIL

        # Detect cover letter requirement
        requires_cover = False
        if (
            "cover letter required" in result_lower
            or "cover letter: required" in result_lower
            or "cover letter: yes" in result_lower
        ):
            requires_cover = True

        # Extract screening questions (basic extraction)
        screening_questions = []
        question_keywords = [
            "authorized to work",
            "years of experience",
            "willing to relocate",
            "salary expectation",
            "start date",
            "sponsorship",
            "require visa",
        ]
        for keyword in question_keywords:
            if keyword in result_lower:
                # Find the sentence containing this keyword
                for line in result.split("\n"):
                    if keyword in line.lower() and "?" in line:
                        screening_questions.append(line.strip())
                        break

        return ApplicationAnalysis(
            application_type=app_type,
            application_url=original_url,  # Could be updated if we detect redirect
            requires_cover_letter=requires_cover,
            requires_resume=True,
            screening_questions=[],  # Would need to convert to ScreeningQuestion objects
            estimated_time_minutes=10 if requires_cover else 5,
        )


async def analyze_with_ai(job_url: str) -> ApplicationAnalysis:
    """Convenience function to analyze a job page with AI.

    Args:
        job_url: URL of the job posting

    Returns:
        ApplicationAnalysis with AI-detected information
    """
    analyzer = AIPageAnalyzer()
    return await analyzer.analyze_page(job_url)


async def smart_analyze(job_url: str, use_ai: bool = False) -> ApplicationAnalysis:
    """Analyze a job application page, optionally using AI.

    First attempts traditional DOM-based analysis. If use_ai is True
    or the traditional analysis returns UNKNOWN type, falls back to
    AI-powered analysis.

    Args:
        job_url: URL of the job posting
        use_ai: Whether to use AI analysis (more accurate but slower/costly)

    Returns:
        ApplicationAnalysis with detected information
    """
    from app.browser.client import get_page
    from app.browser.extractors import analyze_application_page

    # First try traditional analysis
    async with get_page() as page:
        await page.goto(job_url, wait_until="networkidle")
        analysis = await analyze_application_page(page)

    # If traditional analysis couldn't determine type and AI is enabled
    if analysis.application_type == ApplicationType.UNKNOWN and use_ai:
        logger.info("Traditional analysis inconclusive, falling back to AI")
        analysis = await analyze_with_ai(job_url)

    return analysis
