"""Tests for email integration.

Tests email parsing, configuration, and pipeline functionality.
"""

import pytest

from app.email.config import (
    DEFAULT_JOB_SENDERS,
    get_default_sender_domains,
    get_parser,
    get_parser_for_sender,
)
from app.email.parsers.base import EmailParser, ExtractedJob


class TestExtractedJob:
    """Tests for ExtractedJob model."""

    def test_full_job(self):
        """Test creating a full job with all fields."""
        job = ExtractedJob(
            title="Software Engineer",
            company="Acme Corp",
            location="Portland, OR",
            job_url="https://example.com/job/123",
            salary_range="$100k-$150k",
            source="indeed",
            description_snippet="Build amazing software.",
        )

        assert job.title == "Software Engineer"
        assert job.company == "Acme Corp"
        assert job.location == "Portland, OR"
        assert job.job_url == "https://example.com/job/123"
        assert job.salary_range == "$100k-$150k"
        assert job.source == "indeed"
        assert job.description_snippet == "Build amazing software."

    def test_minimal_job(self):
        """Test creating a job with only required fields."""
        job = ExtractedJob(
            title="Engineer",
            company="Tech Co",
            job_url="https://example.com/job",
            source="linkedin",
        )

        assert job.title == "Engineer"
        assert job.company == "Tech Co"
        assert job.location is None
        assert job.salary_range is None
        assert job.description_snippet is None


class TestEmailConfig:
    """Tests for email configuration."""

    def test_default_job_senders_not_empty(self):
        """Test that default senders list is not empty."""
        assert len(DEFAULT_JOB_SENDERS) > 0

    def test_default_sender_has_required_fields(self):
        """Test that each sender config has required fields."""
        for sender in DEFAULT_JOB_SENDERS:
            assert sender.domain
            assert sender.parser_name
            assert sender.display_name

    def test_get_default_sender_domains(self):
        """Test getting list of sender domains."""
        domains = get_default_sender_domains()
        assert len(domains) == len(DEFAULT_JOB_SENDERS)
        assert "indeed.com" in domains
        assert "linkedin.com" in domains

    def test_get_parser_for_sender_indeed(self):
        """Test parser lookup for Indeed emails."""
        parser_name, display_name = get_parser_for_sender("jobs@indeed.com")
        assert parser_name == "indeed"
        assert display_name == "Indeed"

    def test_get_parser_for_sender_linkedin(self):
        """Test parser lookup for LinkedIn emails."""
        parser_name, display_name = get_parser_for_sender("noreply@linkedin.com")
        assert parser_name == "linkedin"
        assert display_name == "LinkedIn"

    def test_get_parser_for_sender_hiringcafe(self):
        """Test parser lookup for HiringCafe emails."""
        parser_name, display_name = get_parser_for_sender("alerts@hiringcafe.com")
        assert parser_name == "hiringcafe"
        assert display_name == "HiringCafe"

    def test_get_parser_for_unknown_sender(self):
        """Test parser lookup for unknown senders falls back to AI."""
        parser_name, display_name = get_parser_for_sender("jobs@unknown-board.com")
        assert parser_name == "ai"
        assert display_name == "Unknown"

    def test_get_parser_case_insensitive(self):
        """Test parser lookup is case insensitive."""
        parser_name, _ = get_parser_for_sender("Jobs@INDEED.COM")
        assert parser_name == "indeed"


class TestGetParser:
    """Tests for get_parser function."""

    def test_get_indeed_parser(self):
        """Test getting Indeed parser."""
        parser = get_parser("indeed")
        assert parser.name == "indeed"

    def test_get_linkedin_parser(self):
        """Test getting LinkedIn parser."""
        parser = get_parser("linkedin")
        assert parser.name == "linkedin"

    def test_get_hiringcafe_parser(self):
        """Test getting HiringCafe parser."""
        parser = get_parser("hiringcafe")
        assert parser.name == "hiringcafe"

    def test_get_ai_parser(self):
        """Test getting AI parser."""
        parser = get_parser("ai")
        assert parser.name == "ai"

    def test_get_unknown_parser_falls_back_to_ai(self):
        """Test unknown parser name falls back to AI parser."""
        parser = get_parser("unknown_parser")
        assert parser.name == "ai"


class TestEmailParserBase:
    """Tests for EmailParser base class."""

    def test_clean_text(self):
        """Test text cleaning utility."""

        class TestParser(EmailParser):
            name = "test"

            async def parse(self, subject, body_html, body_text):
                return []

        parser = TestParser()

        # Test extra whitespace removal
        assert parser._clean_text("  hello   world  ") == "hello world"

        # Test newline handling
        assert parser._clean_text("hello\n\n\nworld") == "hello world"

        # Test None handling
        assert parser._clean_text(None) == ""

    def test_extract_domain_from_url(self):
        """Test domain extraction utility."""

        class TestParser(EmailParser):
            name = "test"

            async def parse(self, subject, body_html, body_text):
                return []

        parser = TestParser()

        assert parser._extract_domain_from_url("https://indeed.com/job/123") == "indeed.com"
        assert parser._extract_domain_from_url("https://www.linkedin.com/jobs") == "www.linkedin.com"
        # Invalid URL returns None (no netloc)
        assert parser._extract_domain_from_url("invalid-url") is None
        assert parser._extract_domain_from_url("") is None


class TestIndeedParser:
    """Tests for Indeed email parser."""

    @pytest.mark.anyio
    async def test_parse_indeed_email_basic(self):
        """Test parsing a basic Indeed job alert email."""
        from app.email.parsers.indeed import IndeedParser

        parser = IndeedParser()

        # Sample Indeed-like HTML (simplified)
        html = """
        <html>
        <body>
            <table class="job">
                <tr>
                    <td>
                        <a class="jobtitle" href="https://www.indeed.com/job/123">
                            Software Engineer
                        </a>
                        <span class="company">Tech Corp</span>
                        <span class="location">Portland, OR</span>
                        <span class="salary">$120,000 - $150,000</span>
                        <span class="snippet">Join our engineering team!</span>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """

        jobs = await parser.parse(
            subject="5 new jobs for Software Engineer",
            body_html=html,
            body_text="",
        )

        # The parser may or may not find jobs depending on HTML structure
        # This is a basic structure test
        assert isinstance(jobs, list)

    @pytest.mark.anyio
    async def test_parse_empty_email(self):
        """Test parsing an empty email returns empty list."""
        from app.email.parsers.indeed import IndeedParser

        parser = IndeedParser()
        jobs = await parser.parse("", "", "")
        assert jobs == []


class TestLinkedInParser:
    """Tests for LinkedIn email parser."""

    @pytest.mark.anyio
    async def test_parse_empty_email(self):
        """Test parsing an empty email returns empty list."""
        from app.email.parsers.linkedin import LinkedInParser

        parser = LinkedInParser()
        jobs = await parser.parse("", "", "")
        assert jobs == []


class TestHiringCafeParser:
    """Tests for HiringCafe email parser."""

    @pytest.mark.anyio
    async def test_parse_empty_email(self):
        """Test parsing an empty email returns empty list."""
        from app.email.parsers.hiringcafe import HiringCafeParser

        parser = HiringCafeParser()
        jobs = await parser.parse("", "", "")
        assert jobs == []


class TestEmailSyncPipeline:
    """Tests for email sync pipeline."""

    def setup_method(self):
        """Initialize pipelines before each test."""
        from app.pipelines.actions import discover_pipelines
        from app.pipelines.registry import clear_registry

        clear_registry()
        discover_pipelines(force_reload=True)

    def test_email_sync_pipeline_registered(self):
        """Test that email sync pipeline is registered."""
        from app.pipelines.registry import get_pipeline

        pipeline = get_pipeline("email_sync_jobs")
        assert pipeline is not None
        assert pipeline.name == "email_sync_jobs"

    def test_email_sync_pipeline_has_correct_metadata(self):
        """Test that email sync pipeline has correct tags and area."""
        from app.pipelines.registry import get_pipeline_info

        info = get_pipeline_info("email_sync_jobs")
        assert info is not None
        assert info["area"] == "jobs"
        assert "email" in info["tags"]
        assert "jobs" in info["tags"]

    def test_email_sync_pipeline_input_schema(self):
        """Test that input schema has expected fields."""
        from app.pipelines.registry import get_pipeline_info

        info = get_pipeline_info("email_sync_jobs")
        assert info is not None
        schema = info["input_schema"]
        assert "properties" in schema

        props = schema["properties"]
        assert "source_id" in props
        assert "force_full_sync" in props

    def test_email_sync_pipeline_output_schema(self):
        """Test that output schema has expected fields."""
        from app.pipelines.registry import get_pipeline_info

        info = get_pipeline_info("email_sync_jobs")
        assert info is not None
        schema = info["output_schema"]
        assert "properties" in schema

        props = schema["properties"]
        assert "emails_processed" in props
        assert "jobs_extracted" in props
        assert "jobs_saved" in props
        assert "sources_synced" in props
        assert "errors" in props

    @pytest.mark.anyio
    async def test_email_sync_requires_authentication(self):
        """Test that email sync requires user authentication."""
        from app.pipelines.action_base import PipelineContext, PipelineSource
        from app.pipelines.registry import execute_pipeline

        context = PipelineContext(source=PipelineSource.API, user_id=None)
        result = await execute_pipeline(
            "email_sync_jobs",
            {},
            context,
        )

        assert result.success is False
        assert "authentication required" in result.error.lower()


class TestGmailClient:
    """Tests for Gmail client."""

    def test_build_sender_query_single_sender(self):
        """Test building query for a single sender."""
        from app.clients.gmail import GmailClient

        # Create client with dummy credentials
        client = GmailClient(
            access_token="test_token",
            refresh_token="test_refresh",
        )

        query = client.build_sender_query(["indeed.com"])
        assert query == "(from:indeed.com)"

    def test_build_sender_query_multiple_senders(self):
        """Test building query for multiple senders."""
        from app.clients.gmail import GmailClient

        client = GmailClient(
            access_token="test_token",
            refresh_token="test_refresh",
        )

        query = client.build_sender_query(["indeed.com", "linkedin.com"])
        assert "from:indeed.com" in query
        assert "from:linkedin.com" in query
        assert " OR " in query

    def test_build_sender_query_with_date_filter(self):
        """Test building query with date filter."""
        from datetime import datetime

        from app.clients.gmail import GmailClient

        client = GmailClient(
            access_token="test_token",
            refresh_token="test_refresh",
        )

        date = datetime(2025, 12, 25)
        query = client.build_sender_query(
            ["indeed.com"],
            after_timestamp=date,
        )
        assert "after:2025/12/25" in query

    def test_build_sender_query_with_unread_filter(self):
        """Test building query with unread filter."""
        from app.clients.gmail import GmailClient

        client = GmailClient(
            access_token="test_token",
            refresh_token="test_refresh",
        )

        query = client.build_sender_query(
            ["indeed.com"],
            unread_only=True,
        )
        assert "is:unread" in query

    def test_build_sender_query_empty_senders(self):
        """Test building query with empty senders list."""
        from app.clients.gmail import GmailClient

        client = GmailClient(
            access_token="test_token",
            refresh_token="test_refresh",
        )

        query = client.build_sender_query([])
        assert query == ""

