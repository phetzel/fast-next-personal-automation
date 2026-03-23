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
from app.email.config import get_default_sender_domains

logger = logging.getLogger(__name__)

JOB_SUBJECT_KEYWORDS = (
    "job alert",
    "jobs for you",
    "recruiter",
    "interview",
    "application",
    "candidate",
    "offer",
)
JOB_SENDER_KEYWORDS = ("linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com")
FINANCE_KEYWORDS = (
    "receipt",
    "invoice",
    "statement",
    "payment",
    "charged",
    "bill",
    "renewal",
    "subscription",
    "order confirmation",
)
FINANCE_SENDERS = (
    "paypal.com",
    "stripe.com",
    "venmo.com",
    "bankofamerica.com",
    "chase.com",
    "discover.com",
    "wellsfargo.com",
    "citibank.com",
    "apple.com",
    "amazon.com",
)
NEWSLETTER_KEYWORDS = ("newsletter", "digest", "roundup", "weekly", "daily", "news update")
NOTIFICATION_KEYWORDS = (
    "notification",
    "alert",
    "activity",
    "security code",
    "status update",
    "commented",
    "mentioned you",
)
SPAM_KEYWORDS = (
    "bitcoin",
    "lottery",
    "casino",
    "viagra",
    "wire transfer",
    "claim your prize",
)


class AITriageResult(BaseModel):
    """Structured result for the AI fallback classifier."""

    bucket: str = Field(description="One of: now, review, done")
    confidence: float = Field(ge=0, le=1)
    actionability_score: float = Field(ge=0, le=1)
    summary: str


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


def _text_blob(email: EmailContent) -> str:
    return " ".join(
        part
        for part in [
            email.subject,
            email.snippet,
            email.body_text[:2000] if email.body_text else "",
            email.body_html[:1000] if email.body_html else "",
        ]
        if part
    ).lower()


def _build_summary(email: EmailContent) -> str:
    preview = email.snippet or email.body_text or email.subject or "(No subject)"
    preview = " ".join(preview.split())
    if not preview:
        preview = email.subject or "(No subject)"
    return shorten(preview, width=160, placeholder="...")


def _looks_spammy(text_blob: str) -> bool:
    return any(keyword in text_blob for keyword in SPAM_KEYWORDS)


def _job_signal(sender: str, text_blob: str) -> tuple[bool, float, float]:
    if any(domain in sender for domain in get_default_sender_domains()):
        return True, 0.97, 0.6
    if any(keyword in sender for keyword in JOB_SENDER_KEYWORDS):
        return True, 0.95, 0.65
    if any(keyword in text_blob for keyword in JOB_SUBJECT_KEYWORDS):
        actionability = (
            0.88
            if any(keyword in text_blob for keyword in ("interview", "offer", "recruiter"))
            else 0.6
        )
        return True, 0.9, actionability
    return False, 0.0, 0.0


def _finance_signal(sender: str, text_blob: str) -> tuple[bool, float, float]:
    if any(keyword in sender for keyword in FINANCE_SENDERS):
        return True, 0.94, 0.55
    if any(keyword in text_blob for keyword in FINANCE_KEYWORDS):
        actionability = (
            0.72
            if any(
                keyword in text_blob for keyword in ("bill", "payment due", "charged", "renewal")
            )
            else 0.45
        )
        return True, 0.9, actionability
    return False, 0.0, 0.0


def _newsletter_signal(
    email: EmailContent, sender: str, text_blob: str
) -> tuple[bool, float, bool]:
    has_list_header = bool(email.list_unsubscribe)
    has_bulk_header = (email.precedence or "").lower() in {"bulk", "list", "junk"}
    keyword_match = any(keyword in text_blob for keyword in NEWSLETTER_KEYWORDS)
    is_newsletter = has_list_header or has_bulk_header or keyword_match
    unsubscribe_candidate = is_newsletter and not _looks_spammy(text_blob)
    if is_newsletter:
        confidence = 0.95 if has_list_header else 0.88
        return True, confidence, unsubscribe_candidate
    if "newsletter" in sender or "digest" in sender:
        return True, 0.84, True
    return False, 0.0, False


def _notification_signal(
    email: EmailContent, sender: str, text_blob: str
) -> tuple[bool, float, float]:
    sender_is_machine = any(
        token in sender for token in ("no-reply", "noreply", "notifications", "alerts")
    )
    auto_submitted = bool(email.auto_submitted and email.auto_submitted.lower() != "no")
    if (
        sender_is_machine
        or auto_submitted
        or any(keyword in text_blob for keyword in NOTIFICATION_KEYWORDS)
    ):
        actionability = 0.55 if "security" in text_blob or "alert" in text_blob else 0.25
        return True, 0.86 if (sender_is_machine or auto_submitted) else 0.82, actionability
    return False, 0.0, 0.0


def _heuristic_fallback(email: EmailContent, text_blob: str) -> TriageClassification:
    sender = _normalized_sender(email.from_address)
    summary = _build_summary(email)
    if any(
        keyword in text_blob for keyword in ("reply", "can you", "please review", "action required")
    ):
        return TriageClassification(
            bucket="now",
            confidence=0.72,
            actionability_score=0.82,
            summary=summary,
            requires_review=True,
            unsubscribe_candidate=False,
            is_vip=False,
        )
    if any(token in sender for token in ("no-reply", "noreply")):
        return TriageClassification(
            bucket="done",
            confidence=0.68,
            actionability_score=0.15,
            summary=summary,
            requires_review=True,
            unsubscribe_candidate=False,
            is_vip=False,
        )
    return TriageClassification(
        bucket="review",
        confidence=0.55,
        actionability_score=0.5,
        summary=summary,
        requires_review=True,
        unsubscribe_candidate=False,
        is_vip=False,
    )


@lru_cache(maxsize=1)
def _get_ai_triage_agent() -> Agent[AITriageResult]:
    return Agent(
        f"openai:{settings.AI_MODEL}",
        result_type=AITriageResult,
        system_prompt="""You are classifying a single email for a personal automation inbox.

Choose one bucket:
- now: likely needs human attention or response soon
- review: ambiguous or potentially important but low confidence
- done: informational or not worth immediate attention

Return a short summary, a confidence score, and an actionability score.
Never classify marketing/newsletters/receipts/jobs/notifications here; those were handled already.
""",
    )


async def _ai_fallback(email: EmailContent) -> TriageClassification | None:
    if not settings.OPENAI_API_KEY:
        return None

    content = "\n".join(
        part
        for part in [
            f"Subject: {email.subject}",
            f"From: {email.from_address}",
            f"Snippet: {email.snippet}",
            f"Body: {(email.body_text or email.body_html)[:4000] if (email.body_text or email.body_html) else ''}",
        ]
        if part
    )

    try:
        result = await _get_ai_triage_agent().run(content)
        data = result.data
        bucket = data.bucket if data.bucket in {"now", "review", "done"} else "review"
        requires_review = bucket == "review" or data.confidence < 0.8
        return TriageClassification(
            bucket=bucket,
            confidence=data.confidence,
            actionability_score=data.actionability_score,
            summary=shorten(" ".join(data.summary.split()), width=160, placeholder="..."),
            requires_review=requires_review,
            unsubscribe_candidate=False,
            is_vip=False,
        )
    except Exception as exc:
        logger.warning("AI triage fallback failed: %s", exc)
        return None


async def classify_email(email: EmailContent) -> TriageClassification:
    """Classify an email into a Phase 1 triage bucket."""
    sender = _normalized_sender(email.from_address)
    text_blob = _text_blob(email)
    summary = _build_summary(email)

    matches: list[tuple[str, float, float | bool]] = []

    job_match, job_confidence, job_actionability = _job_signal(sender, text_blob)
    if job_match:
        matches.append(("jobs", job_confidence, job_actionability))

    finance_match, finance_confidence, finance_actionability = _finance_signal(sender, text_blob)
    if finance_match:
        matches.append(("finance", finance_confidence, finance_actionability))

    newsletter_match, newsletter_confidence, unsubscribe_candidate = _newsletter_signal(
        email, sender, text_blob
    )
    if newsletter_match:
        matches.append(("newsletter", newsletter_confidence, 0.18))

    notification_match, notification_confidence, notification_actionability = _notification_signal(
        email, sender, text_blob
    )
    if notification_match:
        matches.append(("notifications", notification_confidence, notification_actionability))

    conflict = len({bucket for bucket, _, _ in matches}) > 1
    if matches:
        bucket, confidence, actionability = matches[0]
        requires_review = confidence < 0.8 or conflict or bucket == "review"
        return TriageClassification(
            bucket=bucket,
            confidence=float(confidence),
            actionability_score=float(actionability),
            summary=summary,
            requires_review=requires_review,
            unsubscribe_candidate=bool(unsubscribe_candidate if bucket == "newsletter" else False),
            is_vip=False,
            conflict=conflict,
        )

    ai_result = await _ai_fallback(email)
    if ai_result is not None:
        return ai_result

    return _heuristic_fallback(email, text_blob)
