"""Classification helpers for the read-only email triage pipeline."""

import logging
from dataclasses import dataclass
from email.utils import parseaddr
from functools import lru_cache
from textwrap import shorten

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from app.clients.gmail import EmailContent
from app.core.config import settings

logger = logging.getLogger(__name__)

VALID_BUCKETS = {"now", "jobs", "finance", "newsletter", "notifications", "review", "done"}


class AITriageResult(BaseModel):
    """Structured result from the AI classifier."""

    bucket: str = Field(
        description="One of: now, jobs, finance, newsletter, notifications, review, done"
    )
    confidence: float = Field(ge=0, le=1)
    actionability_score: float = Field(ge=0, le=1)
    summary: str = Field(description="One-sentence summary of the email's purpose")
    unsubscribe_candidate: bool = Field(
        description="True if this is marketing/promotional and the user likely didn't opt in"
    )


@dataclass
class TriageClassification:
    """Final triage classification result."""

    bucket: str
    confidence: float
    actionability_score: float
    summary: str
    requires_review: bool
    unsubscribe_candidate: bool
    is_vip: bool
    conflict: bool = False


def _normalized_sender(from_address: str) -> str:
    _, email_address = parseaddr(from_address)
    return (email_address or from_address).strip().lower()


def _build_summary(email: EmailContent) -> str:
    preview = email.snippet or email.body_text or email.subject or "(No subject)"
    preview = " ".join(preview.split())
    if not preview:
        preview = email.subject or "(No subject)"
    return shorten(preview, width=160, placeholder="...")


def _has_unsubscribe_signals(email: EmailContent) -> bool:
    """Check email headers for newsletter/bulk mail signals."""
    if email.list_unsubscribe:
        return True
    return (email.precedence or "").lower() in {"bulk", "list", "junk"}


@lru_cache(maxsize=1)
def _get_ai_triage_agent() -> Agent[AITriageResult]:
    return Agent(
        f"openai:{settings.AI_MODEL}",
        result_type=AITriageResult,
        system_prompt="""\
You are classifying a single email for a personal inbox triage system.

Classify into exactly ONE bucket based on the subject line and sender:

- **now**: Requires a human reply or action soon (e.g., personal messages, direct questions, \
meeting requests, urgent requests from real people).
- **jobs**: Job alerts, job listings, application updates, interview scheduling, recruiter \
outreach, hiring platform digests (e.g., LinkedIn, Indeed, HiringCafe, Greenhouse).
- **finance**: Receipts, invoices, payment confirmations, billing statements, bank alerts, \
subscription charges, order confirmations. Must be a TRANSACTIONAL email about money, not a \
promotional email from a company that also does transactions.
- **newsletter**: Newsletters, digests, content roundups, event announcements, community \
updates. Informational content the user subscribed to.
- **notifications**: Automated system notifications, security alerts, CI/CD alerts, app \
activity notifications (e.g., GitHub, Slack, calendar reminders).
- **review**: Genuinely ambiguous — you cannot confidently pick another bucket.
- **done**: Purely informational, no action needed, low value (e.g., shipping updates already \
delivered, completed event reminders).

Key distinctions:
- A PROMOTIONAL email from Netflix/Amazon/Spotify ("save 40%", "new releases") is **newsletter**, \
NOT finance. Finance is only for actual charges/receipts/statements.
- A job DIGEST from HiringCafe/LinkedIn is **jobs**, even if it looks like a newsletter format.
- An event announcement from Meetup/Bandsintown/Eventbrite is **newsletter**.
- Security codes and 2FA are **notifications**.

Set unsubscribe_candidate=true for promotional/marketing emails the user likely didn't \
explicitly opt into (sales, promotions, ads). Newsletters the user chose to subscribe to \
should be false.

Be decisive. Only use "review" when truly uncertain.
""",
    )


async def _ai_classify(email: EmailContent) -> TriageClassification | None:
    """Classify an email using the AI agent."""
    if not settings.OPENAI_API_KEY:
        return None

    content = f"Subject: {email.subject}\nFrom: {email.from_address}"

    try:
        result = await _get_ai_triage_agent().run(content)
        data = result.data
        bucket = data.bucket if data.bucket in VALID_BUCKETS else "review"
        requires_review = bucket == "review" or data.confidence < 0.75

        # Merge AI unsubscribe signal with email header signals
        unsubscribe_candidate = data.unsubscribe_candidate or _has_unsubscribe_signals(email)

        return TriageClassification(
            bucket=bucket,
            confidence=data.confidence,
            actionability_score=data.actionability_score,
            summary=shorten(" ".join(data.summary.split()), width=160, placeholder="..."),
            requires_review=requires_review,
            unsubscribe_candidate=unsubscribe_candidate,
            is_vip=False,
        )
    except Exception as exc:
        logger.warning("AI triage classification failed: %s", exc)
        return None


def _heuristic_fallback(email: EmailContent) -> TriageClassification:
    """Last-resort fallback when AI is unavailable."""
    sender = _normalized_sender(email.from_address)
    summary = _build_summary(email)

    if any(token in sender for token in ("no-reply", "noreply")):
        return TriageClassification(
            bucket="notifications",
            confidence=0.6,
            actionability_score=0.2,
            summary=summary,
            requires_review=True,
            unsubscribe_candidate=_has_unsubscribe_signals(email),
            is_vip=False,
        )

    return TriageClassification(
        bucket="review",
        confidence=0.5,
        actionability_score=0.5,
        summary=summary,
        requires_review=True,
        unsubscribe_candidate=_has_unsubscribe_signals(email),
        is_vip=False,
    )


async def classify_email(email: EmailContent) -> TriageClassification:
    """Classify an email into a triage bucket using AI, with heuristic fallback."""
    ai_result = await _ai_classify(email)
    if ai_result is not None:
        return ai_result

    return _heuristic_fallback(email)
