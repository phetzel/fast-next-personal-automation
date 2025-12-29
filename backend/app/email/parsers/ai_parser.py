"""AI-powered email parser for unknown job board formats.

Uses PydanticAI to extract job listings from any email format.
"""

import logging
from html import unescape
from re import sub

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from app.email.parsers.base import EmailParser, ExtractedJob

logger = logging.getLogger(__name__)


class AIExtractedJob(BaseModel):
    """Job listing extracted by AI."""

    title: str = Field(description="The job title")
    company: str = Field(description="The company name")
    location: str | None = Field(default=None, description="Job location if mentioned")
    job_url: str = Field(description="URL to apply or view the job")
    salary_range: str | None = Field(default=None, description="Salary if mentioned")
    description_snippet: str | None = Field(
        default=None, description="Brief description of the job"
    )


class AIExtractionResult(BaseModel):
    """Result from AI extraction."""

    jobs: list[AIExtractedJob] = Field(
        default_factory=list, description="List of job listings found in the email"
    )
    is_job_email: bool = Field(
        description="Whether this email contains job listings"
    )


class AIEmailParser(EmailParser):
    """AI-powered parser for unknown email formats.

    Uses PydanticAI to intelligently extract job listings from
    any email format when template-based parsers aren't available.
    """

    name = "ai"

    def __init__(self, model: str = "openai:gpt-4o-mini"):
        """Initialize AI parser.

        Args:
            model: PydanticAI model string to use.
        """
        self.model = model

    async def parse(
        self,
        subject: str,
        body_html: str,
        body_text: str,
    ) -> list[ExtractedJob]:
        """Extract job listings using AI.

        Args:
            subject: Email subject line.
            body_html: HTML body of the email.
            body_text: Plain text body of the email.

        Returns:
            List of extracted job listings.
        """
        # Prefer plain text, fall back to cleaned HTML
        content = body_text if body_text else self._html_to_text(body_html)

        if not content or len(content.strip()) < 50:
            logger.warning("Email has insufficient content for AI parsing")
            return []

        # Truncate very long emails
        max_chars = 15000
        if len(content) > max_chars:
            content = content[:max_chars] + "\n...[truncated]"

        try:
            agent = Agent(
                self.model,
                result_type=AIExtractionResult,
                system_prompt="""You are an expert at extracting job listings from emails.

Given an email, identify all job postings and extract:
- Job title
- Company name
- Location (if mentioned)
- Job URL (the link to apply or view the job)
- Salary range (if mentioned)
- Brief description snippet

If the email doesn't contain job listings, set is_job_email to false.

Important:
- Only extract actual job postings, not job search tips or articles
- The job_url should be a real URL from the email, not made up
- If you can't find a URL for a job, skip that job
- Clean up the data: remove extra whitespace, fix encoding issues
""",
            )

            prompt = f"""Extract all job listings from this email:

Subject: {subject}

Content:
{content}
"""

            result = await agent.run(prompt)
            extraction = result.data

            if not extraction.is_job_email:
                logger.info("AI determined email does not contain job listings")
                return []

            jobs = []
            for ai_job in extraction.jobs:
                # Validate URL
                if not ai_job.job_url or not ai_job.job_url.startswith("http"):
                    continue

                jobs.append(
                    ExtractedJob(
                        title=ai_job.title,
                        company=ai_job.company,
                        location=ai_job.location,
                        job_url=ai_job.job_url,
                        salary_range=ai_job.salary_range,
                        source="email",
                        description_snippet=ai_job.description_snippet,
                    )
                )

            logger.info(f"AI extracted {len(jobs)} jobs from email")
            return jobs

        except Exception as e:
            logger.error(f"AI parsing failed: {e}")
            return []

    def _html_to_text(self, html: str) -> str:
        """Convert HTML to plain text."""
        if not html:
            return ""

        # Remove script and style elements
        text = sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=2)

        # Replace br and p tags with newlines
        text = sub(r"<br\s*/?>", "\n", text, flags=2)
        text = sub(r"</p>", "\n\n", text, flags=2)
        text = sub(r"</div>", "\n", text, flags=2)
        text = sub(r"</tr>", "\n", text, flags=2)

        # Remove all remaining tags
        text = sub(r"<[^>]+>", " ", text)

        # Decode HTML entities
        text = unescape(text)

        # Clean up whitespace
        text = sub(r"[ \t]+", " ", text)
        text = sub(r"\n\s*\n", "\n\n", text)

        return text.strip()

