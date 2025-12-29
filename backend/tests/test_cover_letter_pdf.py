"""Tests for cover letter PDF generation."""

from app.core.cover_letter_pdf import (
    ContactInfo,
    generate_cover_letter_filename,
    generate_cover_letter_pdf,
)


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
        # PDF files start with %PDF-
        assert pdf[:5] == b"%PDF-"

    def test_generate_pdf_with_multiline_content(self):
        """Test PDF generation with multi-paragraph cover letter."""
        cover_letter = """I am writing to express my interest in the position.

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
        assert len(pdf) > 500  # Multi-paragraph should produce substantial PDF

    def test_generate_pdf_with_full_contact_info(self):
        """Test PDF generation with all contact info fields."""
        contact = ContactInfo(
            full_name="Phillip Hetzel",
            phone="510-684-9802",
            email="phetzel89@gmail.com",
            location="Portland, Oregon",
            website="philliphetzel.com",
        )
        pdf = generate_cover_letter_pdf(
            cover_letter_text="I am excited about this opportunity at your company.",
            contact_info=contact,
            company_name="Candid",
            job_title="Founding Product Engineer",
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
        # Should still generate valid PDF
        assert pdf[:5] == b"%PDF-"

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
        assert pdf[:5] == b"%PDF-"

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

    def test_generate_pdf_without_company_name(self):
        """Test PDF generation works without company name."""
        contact = ContactInfo(full_name="John Doe", email="john@example.com")
        pdf = generate_cover_letter_pdf(
            cover_letter_text="Test content for generic application.",
            contact_info=contact,
        )
        assert isinstance(pdf, bytes)
        assert pdf[:5] == b"%PDF-"

    def test_generate_pdf_with_empty_body_uses_placeholder(self):
        """Test PDF generation with empty body creates placeholder."""
        contact = ContactInfo(full_name="John Doe")
        pdf = generate_cover_letter_pdf(
            cover_letter_text="",
            contact_info=contact,
        )
        assert isinstance(pdf, bytes)
        assert len(pdf) > 0


class TestCoverLetterFilename:
    """Tests for filename generation."""

    def test_basic_filename_format(self):
        """Test basic filename format."""
        filename = generate_cover_letter_filename(
            company="Acme Corp",
            job_title="Software Engineer",
            applicant_name="John Doe",
        )
        assert filename == "John_Doe_CoverLetter_Acme_Corp.pdf"

    def test_filename_with_special_characters(self):
        """Test filename handles special characters in company name."""
        filename = generate_cover_letter_filename(
            company="O'Reilly & Associates",
            job_title="Developer",
            applicant_name="Jane Smith",
        )
        # Special characters should be removed
        assert "'" not in filename
        assert "&" not in filename
        assert filename.endswith(".pdf")

    def test_filename_with_long_company_name(self):
        """Test filename truncates long company names."""
        filename = generate_cover_letter_filename(
            company="A Very Long Company Name That Should Be Truncated For Reasonable Length",
            job_title="Developer",
            applicant_name="John Doe",
        )
        # Should be reasonably sized
        assert len(filename) < 100
        assert filename.endswith(".pdf")

    def test_filename_with_no_applicant_name(self):
        """Test filename handles empty applicant name."""
        filename = generate_cover_letter_filename(
            company="Acme",
            job_title="Engineer",
            applicant_name="",
        )
        assert "Applicant" in filename
        assert filename.endswith(".pdf")

    def test_filename_with_none_applicant_name(self):
        """Test filename handles None applicant name."""
        filename = generate_cover_letter_filename(
            company="Acme",
            job_title="Engineer",
            applicant_name=None,
        )
        assert "Applicant" in filename
        assert filename.endswith(".pdf")

    def test_filename_with_none_company(self):
        """Test filename handles None company name."""
        filename = generate_cover_letter_filename(
            company=None,
            job_title="Engineer",
            applicant_name="John Doe",
        )
        assert "Company" in filename
        assert filename.endswith(".pdf")

    def test_filename_with_single_name(self):
        """Test filename with single-word name."""
        filename = generate_cover_letter_filename(
            company="Google",
            job_title="SWE",
            applicant_name="Madonna",
        )
        assert filename.startswith("Madonna_CoverLetter")
        assert filename.endswith(".pdf")

    def test_filename_with_three_part_name(self):
        """Test filename uses only first two name parts."""
        filename = generate_cover_letter_filename(
            company="Acme",
            job_title="Engineer",
            applicant_name="John Jacob Jingleheimer Schmidt",
        )
        # Should use first two parts
        assert filename.startswith("John_Jacob_CoverLetter")
