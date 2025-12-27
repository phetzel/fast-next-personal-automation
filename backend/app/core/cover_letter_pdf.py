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
from dataclasses import dataclass
from datetime import datetime
from io import BytesIO

from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate

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

    # Header style for applicant name (bold, larger)
    name_style = ParagraphStyle(
        "Name",
        parent=styles["Normal"],
        fontSize=14,
        fontName="Helvetica-Bold",
        spaceAfter=2,
        leading=18,
    )

    # Contact info line style (stacked, left-aligned)
    contact_line_style = ParagraphStyle(
        "ContactLine",
        parent=styles["Normal"],
        fontSize=10,
        fontName="Helvetica",
        textColor="#333333",
        spaceAfter=2,
        leading=14,
    )

    # Date style
    date_style = ParagraphStyle(
        "Date",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica",
        spaceBefore=16,
        spaceAfter=16,
    )

    # Greeting style (Dear Hiring Manager,)
    greeting_style = ParagraphStyle(
        "Greeting",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica",
        spaceAfter=12,
    )

    # Body paragraph style (justified)
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica",
        leading=16,
        alignment=TA_JUSTIFY,
        spaceAfter=12,
    )

    # Closing style (Sincerely,)
    closing_style = ParagraphStyle(
        "Closing",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica",
        alignment=TA_LEFT,
        spaceBefore=16,
        spaceAfter=4,
    )

    # Signature style (name at bottom)
    signature_style = ParagraphStyle(
        "Signature",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica-Bold",
        spaceBefore=24,
    )

    return {
        "name": name_style,
        "contact_line": contact_line_style,
        "date": date_style,
        "greeting": greeting_style,
        "body": body_style,
        "closing": closing_style,
        "signature": signature_style,
    }


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

    # Create document with margins
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=1 * inch,
        rightMargin=1 * inch,
        topMargin=1 * inch,
        bottomMargin=1 * inch,
    )

    # Get custom styles
    styles = _create_styles()

    # Build document content
    story = []

    # === HEADER BLOCK ===
    # Name (bold, larger)
    name = contact_info.full_name or "Applicant"
    story.append(Paragraph(name, styles["name"]))

    # Contact info lines (stacked)
    if contact_info.phone:
        story.append(Paragraph(contact_info.phone, styles["contact_line"]))

    if contact_info.email:
        story.append(Paragraph(contact_info.email, styles["contact_line"]))

    if contact_info.location:
        story.append(Paragraph(contact_info.location, styles["contact_line"]))

    if contact_info.website:
        story.append(Paragraph(contact_info.website, styles["contact_line"]))

    # === DATE ===
    today = datetime.now()
    formatted_date = today.strftime("%B %d, %Y")
    story.append(Paragraph(formatted_date, styles["date"]))

    # === GREETING ===
    story.append(Paragraph("Dear Hiring Manager,", styles["greeting"]))

    # === BODY PARAGRAPHS ===
    paragraphs = _format_cover_letter_paragraphs(cover_letter_text)

    if not paragraphs:
        # Fallback if no valid paragraphs found
        paragraphs = ["[Cover letter content goes here]"]

    for para in paragraphs:
        story.append(Paragraph(para, styles["body"]))

    # === CLOSING ===
    story.append(Paragraph("Sincerely,", styles["closing"]))

    # === SIGNATURE ===
    story.append(Paragraph(name, styles["signature"]))

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
    job_title: str | None,
    applicant_name: str | None,
) -> str:
    """Generate a professional filename for the cover letter.

    Format: FirstName_LastName_CoverLetter_Company.pdf
    """

    def clean_for_filename(s: str) -> str:
        if not s:
            return ""
        # Remove special characters, keep alphanumeric and spaces
        cleaned = "".join(c if c.isalnum() or c == " " else "" for c in s)
        # Replace spaces with underscores and trim
        return "_".join(cleaned.split())[:30]

    # Build name slug
    if applicant_name:
        name_parts = applicant_name.split()
        name_slug = "_".join(name_parts[:2])  # First and last name
    else:
        name_slug = "Applicant"

    # Build company slug
    company_slug = clean_for_filename(company) if company else "Company"

    return f"{name_slug}_CoverLetter_{company_slug}.pdf"
