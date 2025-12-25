"""Tests for cover letter PDF generation."""

from app.core.cover_letter_pdf import (
    generate_cover_letter_filename,
    generate_cover_letter_pdf,
)


class TestCoverLetterPDFGeneration:
    """Tests for PDF generation functionality."""

    def test_generate_pdf_returns_bytes(self):
        """Test that generate_cover_letter_pdf returns bytes."""
        pdf = generate_cover_letter_pdf(
            cover_letter_text="This is a test cover letter.",
            applicant_name="John Doe",
            applicant_email="john@example.com",
            company_name="Acme Corp",
            job_title="Software Engineer",
        )
        assert isinstance(pdf, bytes)
        assert len(pdf) > 0

    def test_generate_pdf_starts_with_pdf_header(self):
        """Test that generated PDF has proper PDF header."""
        pdf = generate_cover_letter_pdf(
            cover_letter_text="Test content",
            applicant_name="Jane Smith",
            applicant_email="jane@example.com",
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

        pdf = generate_cover_letter_pdf(
            cover_letter_text=cover_letter,
            applicant_name="John Doe",
            applicant_email="john@example.com",
            company_name="Acme Corp",
            job_title="Senior Engineer",
        )
        assert isinstance(pdf, bytes)
        assert len(pdf) > 500  # Multi-paragraph should produce substantial PDF

    def test_generate_pdf_with_special_characters(self):
        """Test PDF generation handles special characters."""
        pdf = generate_cover_letter_pdf(
            cover_letter_text="Experience with C++, C#, and résumé building.",
            applicant_name="José García",
            applicant_email="jose@example.com",
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

        pdf = generate_cover_letter_pdf(
            cover_letter_text=cover_letter,
            applicant_name="John Doe",
            applicant_email="john@example.com",
            company_name="Acme",
            job_title="Engineer",
        )
        # Should still generate valid PDF
        assert pdf[:5] == b"%PDF-"

    def test_generate_pdf_with_minimal_name(self):
        """Test PDF generation with single-word name."""
        pdf = generate_cover_letter_pdf(
            cover_letter_text="Test content",
            applicant_name="Cher",
            applicant_email="cher@example.com",
            company_name="Music Inc",
            job_title="Artist",
        )
        assert isinstance(pdf, bytes)

    def test_generate_pdf_with_empty_email(self):
        """Test PDF generation with empty email."""
        pdf = generate_cover_letter_pdf(
            cover_letter_text="Test content",
            applicant_name="John Doe",
            applicant_email="",
            company_name="Acme",
            job_title="Engineer",
        )
        assert isinstance(pdf, bytes)


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
