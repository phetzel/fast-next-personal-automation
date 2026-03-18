"""Cover letter PDF generation service.

Generates professional PDF cover letters from text content using ReportLab.
Stores generated PDFs in S3 for later retrieval and upload to job applications.

Template format:
    Phillip Hetzel
    510-684-9802
    phetzel89@gmail.com
    Portland, Oregon
    philliphetzel.com

    December 26, 2025

    Dear Hiring Manager,

    [Body paragraphs...]

    Sincerely,
    Phillip Hetzel
"""

import logging
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from html import escape
from io import BytesIO

from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

logger = logging.getLogger(__name__)


@dataclass
class ContactInfo:
    """Contact information for cover letter header."""

    full_name: str
    phone: str | None = None
    email: str | None = None
    location: str | None = None
    website: str | None = None


def _create_styles() -> dict:
    """Create custom paragraph styles for the cover letter."""
    styles = getSampleStyleSheet()

    # Header style for applicant name
    name_style = ParagraphStyle(
        "Name",
        parent=styles["Normal"],
        fontSize=14,
        fontName="Helvetica-Bold",
        spaceAfter=4,
        leading=18,
    )

    # Inline contact line under the name
    contact_style = ParagraphStyle(
        "Contact",
        parent=styles["Normal"],
        fontSize=10,
        fontName="Helvetica",
        textColor="#333333",
        spaceAfter=18,
        leading=13,
    )

    # Date style
    date_style = ParagraphStyle(
        "Date",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica",
        spaceAfter=14,
    )

    # Greeting style
    salutation_style = ParagraphStyle(
        "Salutation",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica",
        spaceAfter=14,
    )

    # Body paragraph style
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica",
        leading=16,
        alignment=TA_LEFT,
        spaceAfter=14,
    )

    # Closing style
    closing_style = ParagraphStyle(
        "Closing",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica",
        alignment=TA_LEFT,
        spaceBefore=10,
        spaceAfter=4,
    )

    # Signature style
    signature_style = ParagraphStyle(
        "Signature",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica",
    )

    return {
        "name": name_style,
        "contact": contact_style,
        "date": date_style,
        "salutation": salutation_style,
        "body": body_style,
        "closing": closing_style,
        "signature": signature_style,
    }


def _slugify_company(company: str | None) -> str:
    """Create a stable, lowercase company slug."""
    if not company:
        return "company"

    normalized = unicodedata.normalize("NFKD", company)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text).strip("-").lower()
    return slug[:40] or "company"


def generate_cover_letter_title(company: str | None) -> str:
    """Generate the embedded PDF title metadata."""
    return f"cover-{_slugify_company(company)}"


def _generate_salutation(company_name: str | None) -> str:
    """Generate a humanized salutation fallback."""
    if company_name and company_name.strip():
        return f"Dear {company_name.strip()} team,"
    return "Dear Hiring Team,"


def _format_contact_line(contact_info: ContactInfo) -> str | None:
    """Join available contact details into a single resume-style line."""
    parts = [
        contact_info.phone,
        contact_info.email,
        contact_info.location,
        contact_info.website,
    ]
    rendered = [escape(part.strip()) for part in parts if part and part.strip()]
    if not rendered:
        return None
    return " | ".join(rendered)


def _format_cover_letter_paragraphs(text: str) -> list[str]:
    """Convert plain text cover letter to list of paragraph strings.

    Handles various input formats:
    - Plain text with double newlines as paragraph separators
    - Text that already has paragraph structure
    - Removes any greeting/closing that might be in the AI output

    The AI should generate body-only content, but this provides fallback
    filtering in case greetings/closings slip through.
    """
    if not text:
        return []

    lines = text.strip().split("\n")

    # Group consecutive non-empty lines into paragraphs
    paragraphs = []
    current_paragraph = []

    # Patterns to filter out (greetings and closings)
    skip_prefixes = (
        "dear ",
        "to whom",
        "hi ",
        "hello ",
        "sincerely",
        "best regards",
        "best,",
        "regards,",
        "thank you,",
        "thanks,",
        "yours truly",
        "yours sincerely",
        "warm regards",
        "warmly,",
        "respectfully",
        "with appreciation",
        "kind regards",
        "cordially",
    )

    for line in lines:
        line = line.strip()
        if line:
            lower_line = line.lower()

            # Skip greetings and closings
            if lower_line.startswith(skip_prefixes):
                continue

            # Skip lines that are just a name (likely signature)
            # Heuristic: short line with no punctuation except maybe period
            if len(line) < 40 and not any(c in line for c in ",;:!?"):
                words = line.split()
                if len(words) <= 3 and all(w[0].isupper() for w in words if w):
                    # Likely just a name, skip it
                    continue

            current_paragraph.append(line)
        else:
            if current_paragraph:
                paragraphs.append(" ".join(current_paragraph))
                current_paragraph = []

    # Don't forget the last paragraph
    if current_paragraph:
        paragraphs.append(" ".join(current_paragraph))

    return [p for p in paragraphs if p]


def generate_cover_letter_pdf(
    cover_letter_text: str,
    contact_info: ContactInfo,
    company_name: str | None = None,
    job_title: str | None = None,
) -> bytes:
    """Generate a professional PDF from cover letter text.

    Args:
        cover_letter_text: The body paragraphs of the cover letter
        contact_info: ContactInfo with applicant details for header
        company_name: Name of the company (unused in current template, for logging)
        job_title: Title of the position (unused in current template, for logging)

    Returns:
        PDF file as bytes
    """
    buffer = BytesIO()

    title = generate_cover_letter_title(company_name)
    subject = (
        f"Cover letter for {job_title} at {company_name}"
        if company_name and job_title
        else "Cover letter"
    )

    # Create document with margins and metadata
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=1 * inch,
        rightMargin=1 * inch,
        topMargin=1 * inch,
        bottomMargin=1 * inch,
        title=title,
        author=contact_info.full_name,
        subject=subject,
    )

    # Get custom styles
    styles = _create_styles()

    # Build document content
    story = []

    # === HEADER BLOCK ===
    name = contact_info.full_name or "Applicant"
    story.append(Paragraph(escape(name), styles["name"]))

    contact_line = _format_contact_line(contact_info)
    if contact_line:
        story.append(Paragraph(contact_line, styles["contact"]))
    else:
        story.append(Spacer(1, 12))

    # === DATE ===
    today = datetime.now()
    formatted_date = today.strftime("%B %d, %Y")
    story.append(Paragraph(formatted_date, styles["date"]))

    # === SALUTATION ===
    story.append(Paragraph(escape(_generate_salutation(company_name)), styles["salutation"]))

    # === BODY PARAGRAPHS ===
    paragraphs = _format_cover_letter_paragraphs(cover_letter_text)

    if not paragraphs:
        # Fallback if no valid paragraphs found
        paragraphs = ["[Cover letter content goes here]"]

    for para in paragraphs:
        story.append(Paragraph(escape(para), styles["body"]))

    # === CLOSING ===
    story.append(Paragraph("Sincerely,", styles["closing"]))

    # === SIGNATURE ===
    story.append(Paragraph(escape(name), styles["signature"]))

    # Build PDF
    doc.build(story)

    pdf_bytes = buffer.getvalue()
    buffer.close()

    # Log with company/job info if provided
    log_context = ""
    if company_name and job_title:
        log_context = f" for {company_name} - {job_title}"
    elif company_name:
        log_context = f" for {company_name}"

    logger.info(f"Generated cover letter PDF{log_context} ({len(pdf_bytes)} bytes)")

    return pdf_bytes


def generate_cover_letter_filename(
    company: str | None,
) -> str:
    """Generate the clean download filename for the cover letter."""
    return f"{generate_cover_letter_title(company)}.pdf"
