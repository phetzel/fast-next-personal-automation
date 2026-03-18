"""Tests for cover letter PDF generation."""

from io import BytesIO

from pypdf import PdfReader

from app.core.cover_letter_pdf import (
    ContactInfo,
    generate_cover_letter_filename,
    generate_cover_letter_pdf,
    generate_cover_letter_title,
)


def _read_pdf(pdf_bytes: bytes) -> tuple[PdfReader, str]:
    reader = PdfReader(BytesIO(pdf_bytes))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    return reader, text


class TestContactInfo:
    """Tests for ContactInfo dataclass."""

    def test_full_contact_info(self):
        """Test ContactInfo with all fields populated."""
        contact = ContactInfo(
            full_name="Phillip Hetzel",
            phone="510-684-9802",
            email="phetzel89@gmail.com",
            location="Portland, Oregon",
            website="philliphetzel.com",
        )
        assert contact.full_name == "Phillip Hetzel"
        assert contact.phone == "510-684-9802"
        assert contact.email == "phetzel89@gmail.com"
        assert contact.location == "Portland, Oregon"
        assert contact.website == "philliphetzel.com"

    def test_minimal_contact_info(self):
        """Test ContactInfo with only required fields."""
        contact = ContactInfo(full_name="John Doe")
        assert contact.full_name == "John Doe"
        assert contact.phone is None
        assert contact.email is None
        assert contact.location is None
        assert contact.website is None


class TestCoverLetterPDFGeneration:
    """Tests for PDF generation functionality."""

    def test_generate_pdf_returns_bytes(self):
        """Test that generate_cover_letter_pdf returns bytes."""
        contact = ContactInfo(
            full_name="John Doe",
            email="john@example.com",
        )
        pdf = generate_cover_letter_pdf(
            cover_letter_text="This is a test cover letter.",
            contact_info=contact,
            company_name="Acme Corp",
            job_title="Software Engineer",
        )
        assert isinstance(pdf, bytes)
        assert len(pdf) > 0

    def test_generate_pdf_starts_with_pdf_header(self):
        """Test that generated PDF has proper PDF header."""
        contact = ContactInfo(
            full_name="Jane Smith",
            email="jane@example.com",
        )
        pdf = generate_cover_letter_pdf(
            cover_letter_text="Test content",
            contact_info=contact,
            company_name="Tech Inc",
            job_title="Developer",
        )
        assert pdf[:5] == b"%PDF-"

    def test_generate_pdf_sets_metadata_and_resume_style_header(self):
        """Test PDF metadata and extracted text reflect the new layout."""
        contact = ContactInfo(
            full_name="Phillip Hetzel",
            phone="510-684-9802",
            email="phetzel89@gmail.com",
            location="Portland, Oregon",
            website="philliphetzel.com",
        )
        pdf = generate_cover_letter_pdf(
            cover_letter_text=(
                "I build practical workflow automation for job-search tooling.\n\n"
                "At my last project, I turned scattered application steps into a tracked system.\n\n"
                "That mix of product thinking and implementation is why this role fits."
            ),
            contact_info=contact,
            company_name="Ziff Davis Shopping",
            job_title="Senior Product Manager",
        )

        reader, text = _read_pdf(pdf)
        metadata = reader.metadata

        assert metadata is not None
        assert metadata.title == "cover-ziff-davis-shopping"
        assert metadata.author == "Phillip Hetzel"
        assert metadata.subject == "Cover letter for Senior Product Manager at Ziff Davis Shopping"

        assert "Phillip Hetzel" in text
        assert "510-684-9802" in text
        assert "phetzel89@gmail.com" in text
        assert "Portland, Oregon" in text
        assert "philliphetzel.com" in text
        assert "Dear Ziff Davis Shopping team," in text
        assert "Dear Hiring Manager," not in text

    def test_generate_pdf_with_multiline_content(self):
        """Test PDF generation with multi-paragraph cover letter."""
        cover_letter = """I am applying for the position.

With over 5 years of experience, I have developed strong skills.

I would welcome the opportunity to discuss how I can contribute."""

        contact = ContactInfo(
            full_name="John Doe",
            phone="555-123-4567",
            email="john@example.com",
            location="San Francisco, CA",
        )
        pdf = generate_cover_letter_pdf(
            cover_letter_text=cover_letter,
            contact_info=contact,
            company_name="Acme Corp",
            job_title="Senior Engineer",
        )
        assert isinstance(pdf, bytes)
        assert len(pdf) > 500

    def test_generate_pdf_with_special_characters(self):
        """Test PDF generation handles special characters."""
        contact = ContactInfo(
            full_name="José García",
            email="jose@example.com",
        )
        pdf = generate_cover_letter_pdf(
            cover_letter_text="Experience with C++, C#, and résumé building.",
            contact_info=contact,
            company_name="Müller & Associates",
            job_title="Developer",
        )
        assert isinstance(pdf, bytes)
        assert len(pdf) > 0
        reader, _ = _read_pdf(pdf)
        assert reader.metadata.title == "cover-muller-associates"

    def test_generate_pdf_filters_greetings_and_closings(self):
        """Test that common greetings/closings are filtered from body."""
        cover_letter = """Dear Hiring Manager,

I am excited to apply for this position.

Sincerely,
John Doe"""

        contact = ContactInfo(
            full_name="John Doe",
            email="john@example.com",
        )
        pdf = generate_cover_letter_pdf(
            cover_letter_text=cover_letter,
            contact_info=contact,
            company_name="Acme",
            job_title="Engineer",
        )

        _, text = _read_pdf(pdf)
        assert "Dear Hiring Manager," not in text
        assert "Dear Acme team," in text
        assert "I am excited to apply for this position." in text

    def test_generate_pdf_filters_warm_regards(self):
        """Test that 'Warm regards' closing is filtered."""
        cover_letter = """I am excited about this opportunity.

Warm regards,
Phillip Hetzel"""

        contact = ContactInfo(full_name="Phillip Hetzel")
        pdf = generate_cover_letter_pdf(
            cover_letter_text=cover_letter,
            contact_info=contact,
        )

        _, text = _read_pdf(pdf)
        assert "Warm regards" not in text
        assert "Dear Hiring Team," in text

    def test_generate_pdf_with_minimal_name(self):
        """Test PDF generation with single-word name."""
        contact = ContactInfo(
            full_name="Cher",
            email="cher@example.com",
        )
        pdf = generate_cover_letter_pdf(
            cover_letter_text="Test content",
            contact_info=contact,
            company_name="Music Inc",
            job_title="Artist",
        )
        assert isinstance(pdf, bytes)

    def test_generate_pdf_with_no_email(self):
        """Test PDF generation with no email."""
        contact = ContactInfo(full_name="John Doe")
        pdf = generate_cover_letter_pdf(
            cover_letter_text="Test content",
            contact_info=contact,
            company_name="Acme",
            job_title="Engineer",
        )
        assert isinstance(pdf, bytes)

    def test_generate_pdf_without_company_name_uses_generic_salutation(self):
        """Test PDF generation works without company name."""
        contact = ContactInfo(full_name="John Doe", email="john@example.com")
        pdf = generate_cover_letter_pdf(
            cover_letter_text="Test content for generic application.",
            contact_info=contact,
        )

        reader, text = _read_pdf(pdf)
        assert reader.metadata.title == "cover-company"
        assert "Dear Hiring Team," in text

    def test_generate_pdf_with_empty_body_uses_placeholder(self):
        """Test PDF generation with empty body creates placeholder."""
        contact = ContactInfo(full_name="John Doe")
        pdf = generate_cover_letter_pdf(
            cover_letter_text="",
            contact_info=contact,
        )

        _, text = _read_pdf(pdf)
        assert "[Cover letter content goes here]" in text


class TestCoverLetterFilename:
    """Tests for filename and title generation."""

    def test_basic_filename_format(self):
        """Test basic filename format."""
        filename = generate_cover_letter_filename(company="Acme Corp")
        assert filename == "cover-acme-corp.pdf"

    def test_title_matches_filename_base(self):
        """Test embedded title and filename use the same slug logic."""
        title = generate_cover_letter_title("Acme Corp")
        filename = generate_cover_letter_filename(company="Acme Corp")
        assert filename == f"{title}.pdf"

    def test_filename_with_special_characters(self):
        """Test filename handles special characters in company name."""
        filename = generate_cover_letter_filename(company="O'Reilly & Associates")
        assert filename == "cover-o-reilly-associates.pdf"

    def test_filename_with_long_company_name(self):
        """Test filename truncates long company names to a stable length."""
        filename = generate_cover_letter_filename(
            company="A Very Long Company Name That Should Be Truncated For Reasonable Length"
        )
        assert filename.startswith("cover-a-very-long-company-name-that-should-b")
        assert filename.endswith(".pdf")
        assert len(filename) <= len("cover-") + 40 + len(".pdf")

    def test_filename_with_none_company(self):
        """Test filename handles missing company name."""
        filename = generate_cover_letter_filename(company=None)
        assert filename == "cover-company.pdf"
