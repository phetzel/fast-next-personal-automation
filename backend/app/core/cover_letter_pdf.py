"""Cover letter PDF generation service.

Generates professional PDF cover letters from text content using ReportLab.
Stores generated PDFs in S3 for later retrieval and upload to job applications.
"""

import logging
from datetime import datetime
from io import BytesIO

from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

logger = logging.getLogger(__name__)


def _create_styles() -> dict:
    """Create custom paragraph styles for the cover letter."""
    styles = getSampleStyleSheet()

    # Header style for applicant name
    header_style = ParagraphStyle(
        "HeaderName",
        parent=styles["Heading1"],
        fontSize=16,
        fontName="Helvetica-Bold",
        textColor="#1e3a5f",
        spaceAfter=6,
        leading=20,
    )

    # Contact info style
    contact_style = ParagraphStyle(
        "Contact",
        parent=styles["Normal"],
        fontSize=10,
        fontName="Helvetica",
        textColor="#4b5563",
        spaceAfter=20,
    )

    # Date style
    date_style = ParagraphStyle(
        "Date",
        parent=styles["Normal"],
        fontSize=10,
        fontName="Helvetica",
        textColor="#4b5563",
        spaceAfter=16,
    )

    # Recipient/company style
    recipient_style = ParagraphStyle(
        "Recipient",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica-Bold",
        textColor="#1e3a5f",
        spaceAfter=4,
    )

    # Subject line style
    subject_style = ParagraphStyle(
        "Subject",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica",
        spaceAfter=20,
    )

    # Body paragraph style
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Times-Roman",
        leading=16,
        alignment=TA_JUSTIFY,
        spaceAfter=12,
    )

    # Closing style
    closing_style = ParagraphStyle(
        "Closing",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Times-Roman",
        alignment=TA_LEFT,
        spaceBefore=20,
        spaceAfter=4,
    )

    # Signature style
    signature_style = ParagraphStyle(
        "Signature",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica-Bold",
        spaceBefore=30,
    )

    return {
        "header": header_style,
        "contact": contact_style,
        "date": date_style,
        "recipient": recipient_style,
        "subject": subject_style,
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
    """
    lines = text.strip().split("\n")

    # Group consecutive non-empty lines into paragraphs
    paragraphs = []
    current_paragraph = []

    for line in lines:
        line = line.strip()
        if line:
            # Skip common greetings/closings that we handle in template
            lower_line = line.lower()
            if lower_line.startswith(
                (
                    "dear ",
                    "to whom",
                    "sincerely",
                    "best regards",
                    "regards,",
                    "thank you,",
                    "yours truly",
                )
            ):
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
    applicant_name: str,
    applicant_email: str,
    company_name: str,
    job_title: str,
) -> bytes:
    """Generate a professional PDF from cover letter text.

    Args:
        cover_letter_text: The plain text cover letter content
        applicant_name: Full name of the applicant
        applicant_email: Email address of the applicant
        company_name: Name of the company being applied to
        job_title: Title of the position

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

    # Header - Applicant name
    name = applicant_name or "Applicant"
    story.append(Paragraph(name, styles["header"]))

    # Contact info
    story.append(Paragraph(applicant_email or "", styles["contact"]))

    # Add a line separator effect with spacer
    story.append(Spacer(1, 10))

    # Date
    today = datetime.now()
    formatted_date = today.strftime("%B %d, %Y")
    story.append(Paragraph(formatted_date, styles["date"]))

    # Recipient/Company
    story.append(Paragraph(company_name, styles["recipient"]))

    # Subject line
    story.append(Paragraph(f"RE: {job_title}", styles["subject"]))

    # Body paragraphs
    paragraphs = _format_cover_letter_paragraphs(cover_letter_text)
    for para in paragraphs:
        story.append(Paragraph(para, styles["body"]))

    # Closing
    story.append(Paragraph("Sincerely,", styles["closing"]))

    # Signature
    story.append(Paragraph(name, styles["signature"]))

    # Build PDF
    doc.build(story)

    pdf_bytes = buffer.getvalue()
    buffer.close()

    logger.info(
        f"Generated cover letter PDF for {company_name} - {job_title} ({len(pdf_bytes)} bytes)"
    )

    return pdf_bytes


def generate_cover_letter_filename(company: str, job_title: str, applicant_name: str) -> str:
    """Generate a professional filename for the cover letter.

    Format: FirstName_LastName_CoverLetter_Company.pdf
    """

    def clean_for_filename(s: str) -> str:
        # Remove special characters, keep alphanumeric and spaces
        cleaned = "".join(c if c.isalnum() or c == " " else "" for c in s)
        # Replace spaces with underscores and trim
        return "_".join(cleaned.split())[:30]

    name_parts = applicant_name.split() if applicant_name else ["Applicant"]
    name_slug = "_".join(name_parts[:2])  # First and last name
    company_slug = clean_for_filename(company)

    return f"{name_slug}_CoverLetter_{company_slug}.pdf"
