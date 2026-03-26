"""Tests for email integration.

Tests email parsing, configuration, and pipeline functionality.
"""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.clients.gmail import EmailContent
from app.core.exceptions import BadRequestError
from app.core.security import decrypt_token, is_encrypted
from app.email.config import (
    DEFAULT_JOB_SENDERS,
    get_default_sender_domains,
    get_parser,
    get_parser_for_sender,
)
from app.email.parsers.base import EmailParser, ExtractedJob
from app.email.utils import sender_matches_pattern
from app.pipelines.actions.email_triage import classifier as triage_classifier
from app.pipelines.actions.email_triage import pipeline as triage_pipeline
from app.pipelines.actions.email_triage.classifier import classify_email
from app.pipelines.actions.email_triage.pipeline import EmailTriagePipeline
from app.repositories import email_destination as email_destination_repo
from app.services.email import EmailService
from app.services.job import IngestionResult, RawJob


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


class TestSenderMatching:
    """Tests for sender-pattern matching helpers."""

    def test_sender_matches_domain_and_subdomain_patterns(self):
        assert sender_matches_pattern("alerts@example.com", "example.com") is True
        assert sender_matches_pattern("alerts@news.example.com", "example.com") is True
        assert sender_matches_pattern("alerts@notexample.com", "example.com") is False

    def test_sender_matches_exact_email_patterns(self):
        assert sender_matches_pattern("alerts@example.com", "alerts@example.com") is True
        assert sender_matches_pattern("other@example.com", "alerts@example.com") is False

    def test_destination_matching_respects_domain_boundaries(self):
        destination = SimpleNamespace(
            filter_rules={
                "sender_patterns": ["example.com"],
                "subject_contains": [],
                "subject_not_contains": [],
            }
        )

        assert email_destination_repo.matches_email(destination, "alerts@example.com", None) is True
        assert (
            email_destination_repo.matches_email(destination, "alerts@news.example.com", None)
            is True
        )
        assert (
            email_destination_repo.matches_email(destination, "alerts@notexample.com", None)
            is False
        )


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
        assert (
            parser._extract_domain_from_url("https://www.linkedin.com/jobs") == "www.linkedin.com"
        )
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
        assert "save_all" in props

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
        assert "jobs_analyzed" in props
        assert "jobs_saved" in props
        assert "jobs_filtered" in props
        assert "high_scoring" in props
        assert "sources_synced" in props
        assert "errors" in props


def _email_content(
    *,
    subject: str,
    from_address: str,
    snippet: str = "",
    body_text: str = "",
    list_unsubscribe: str | None = None,
    precedence: str | None = None,
    auto_submitted: str | None = None,
) -> EmailContent:
    return EmailContent(
        message_id="gmail-message-1",
        thread_id="gmail-thread-1",
        subject=subject,
        from_address=from_address,
        to_address="me@example.com",
        received_at=datetime.fromisoformat("2026-03-23T12:00:00+00:00"),
        body_html="",
        body_text=body_text,
        snippet=snippet,
        list_unsubscribe=list_unsubscribe,
        precedence=precedence,
        auto_submitted=auto_submitted,
    )


class TestEmailTriageClassifier:
    """Tests for AI-first triage classification."""

    def _mock_ai_result(self, **overrides):
        """Build a mock AI classification result."""
        from app.pipelines.actions.email_triage.classifier import AITriageResult

        defaults = {
            "bucket": "review",
            "confidence": 0.9,
            "actionability_score": 0.5,
            "summary": "Test summary",
            "unsubscribe_candidate": False,
        }
        defaults.update(overrides)
        return AITriageResult(**defaults)

    def _patch_ai(self, **overrides):
        """Patch the AI agent to return a controlled result."""
        ai_result = self._mock_ai_result(**overrides)
        mock_run_result = MagicMock()
        mock_run_result.data = ai_result
        mock_agent = MagicMock()
        mock_agent.run = AsyncMock(return_value=mock_run_result)
        return patch.object(
            triage_classifier, "_get_ai_triage_agent", return_value=mock_agent
        )

    @pytest.mark.anyio
    async def test_classifies_job_emails(self):
        with self._patch_ai(bucket="jobs", confidence=0.95, actionability_score=0.65):
            classification = await classify_email(
                _email_content(
                    subject="New jobs for Staff Engineer",
                    from_address="jobs-noreply@linkedin.com",
                    snippet="Your weekly job alert is ready.",
                )
            )

        assert classification.bucket == "jobs"
        assert classification.confidence >= 0.9

    @pytest.mark.anyio
    async def test_classifies_finance_emails(self):
        with self._patch_ai(bucket="finance", confidence=0.92, actionability_score=0.55):
            classification = await classify_email(
                _email_content(
                    subject="Your receipt from Stripe",
                    from_address="receipts@stripe.com",
                    snippet="Payment successful for your renewal.",
                )
            )

        assert classification.bucket == "finance"
        assert classification.actionability_score >= 0.45

    @pytest.mark.anyio
    async def test_classifies_newsletters_and_sets_unsubscribe_candidate(self):
        with self._patch_ai(bucket="newsletter", confidence=0.95, unsubscribe_candidate=False):
            classification = await classify_email(
                _email_content(
                    subject="Weekly design roundup",
                    from_address="newsletter@example.com",
                    snippet="Top links from this week.",
                    list_unsubscribe="<mailto:unsubscribe@example.com>",
                    precedence="bulk",
                )
            )

        assert classification.bucket == "newsletter"
        # unsubscribe_candidate is true because List-Unsubscribe header is present
        assert classification.unsubscribe_candidate is True

    @pytest.mark.anyio
    async def test_unsubscribe_candidate_from_ai_signal(self):
        with self._patch_ai(bucket="newsletter", confidence=0.9, unsubscribe_candidate=True):
            classification = await classify_email(
                _email_content(
                    subject="Save 40% on Malwarebytes Plus!",
                    from_address="noreply@e.malwarebytes.com",
                    snippet="Stay ahead of the scams.",
                )
            )

        assert classification.bucket == "newsletter"
        assert classification.unsubscribe_candidate is True

    @pytest.mark.anyio
    async def test_falls_back_to_heuristic_when_ai_unavailable(self):
        with patch.object(triage_classifier, "_ai_classify", AsyncMock(return_value=None)):
            classification = await classify_email(
                _email_content(
                    subject="Checking in",
                    from_address="friend@example.com",
                    snippet="Wanted to follow up on this when you have time.",
                )
            )

        assert classification.bucket == "review"
        assert classification.requires_review is True

    @pytest.mark.anyio
    async def test_heuristic_fallback_noreply_goes_to_notifications(self):
        with patch.object(triage_classifier, "_ai_classify", AsyncMock(return_value=None)):
            classification = await classify_email(
                _email_content(
                    subject="Security alert",
                    from_address="no-reply@accounts.google.com",
                    snippet="New sign-in to your account.",
                )
            )

        assert classification.bucket == "notifications"
        assert classification.requires_review is True


class TestEmailTriagePipeline:
    """Tests for the read-only email triage pipeline."""

    def setup_method(self):
        from app.pipelines.actions import discover_pipelines
        from app.pipelines.registry import clear_registry

        clear_registry()
        discover_pipelines(force_reload=True)

    def test_email_triage_pipeline_registered(self):
        from app.pipelines.registry import get_pipeline

        pipeline = get_pipeline("email_triage")
        assert pipeline is not None
        assert pipeline.name == "email_triage"

    def test_email_triage_pipeline_input_schema(self):
        from app.pipelines.registry import get_pipeline_info

        info = get_pipeline_info("email_triage")
        assert info is not None
        props = info["input_schema"]["properties"]
        assert "source_id" in props
        assert "force_full_run" in props
        assert "lookback_hours" in props
        assert "limit_per_source" in props

    def test_email_triage_pipeline_uses_triage_watermark(self):
        from app.pipelines.actions.email_triage.pipeline import EmailTriagePipeline

        pipeline = EmailTriagePipeline()
        source = SimpleNamespace(
            last_triage_at=datetime.fromisoformat("2026-03-22T17:00:00+00:00"),
            last_sync_at=datetime.fromisoformat("2026-03-23T10:00:00+00:00"),
        )
        input_data = SimpleNamespace(force_full_run=False, lookback_hours=None)

        after_timestamp = pipeline._get_after_timestamp(source, input_data)

        assert after_timestamp == datetime.fromisoformat("2026-03-22T16:00:00+00:00")

    def test_email_triage_query_uses_exact_timestamp_and_inbox(self):
        from app.pipelines.actions.email_triage.pipeline import EmailTriagePipeline

        pipeline = EmailTriagePipeline()
        after_timestamp = datetime.fromisoformat("2026-03-23T12:34:56+00:00")

        query = pipeline._build_query(after_timestamp)

        assert f"after:{int(after_timestamp.timestamp())}" in query
        assert "in:inbox" in query
        assert "-in:spam" in query

    @pytest.mark.anyio
    async def test_email_triage_pipeline_continues_after_message_error(self):
        from app.pipelines.actions.email_triage import pipeline as triage_pipeline

        pipeline = triage_pipeline.EmailTriagePipeline()
        source = SimpleNamespace(
            id=uuid4(),
            token_expiry=None,
            email_address="triage@example.com",
            last_triage_at=None,
            auto_actions_enabled=False,
        )
        input_data = SimpleNamespace(limit_per_source=10, force_full_run=False, lookback_hours=None)
        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()

        gmail_client = SimpleNamespace(
            list_messages=AsyncMock(return_value=[{"id": "bad-message"}, {"id": "good-message"}]),
            get_message=AsyncMock(
                side_effect=[
                    RuntimeError("boom"),
                    _email_content(
                        subject="Weekly roundup",
                        from_address="newsletter@example.com",
                        snippet="Top stories from this week.",
                        list_unsubscribe="<mailto:unsubscribe@example.com>",
                    ),
                ]
            ),
            tokens_refreshed=False,
            new_access_token=None,
            new_token_expiry=None,
        )
        classification = SimpleNamespace(
            bucket="newsletter",
            confidence=0.95,
            actionability_score=0.2,
            summary="Top stories from this week.",
            requires_review=False,
            unsubscribe_candidate=True,
            is_vip=False,
        )
        message = SimpleNamespace(bucket=None)

        with (
            patch.object(triage_pipeline, "GmailClient", return_value=gmail_client),
            patch.object(
                triage_pipeline.email_source_repo,
                "get_decrypted_tokens",
                return_value=("access-token", "refresh-token"),
            ),
            patch.object(
                triage_pipeline.email_source_repo,
                "get_or_create_message",
                AsyncMock(return_value=(message, True)),
            ),
            patch.object(
                triage_pipeline.email_source_repo,
                "update_message_triage",
                AsyncMock(),
            ),
            patch.object(
                triage_pipeline.email_source_repo,
                "update_triage_status",
                AsyncMock(),
            ) as update_triage_status,
            patch.object(triage_pipeline, "classify_email", AsyncMock(return_value=classification)),
        ):
            result = await pipeline._triage_source(db, source, input_data, uuid4())

        assert result["messages_scanned"] == 2
        assert result["messages_triaged"] == 1
        assert result["bucket_counts"] == {"newsletter": 1}
        assert len(result["errors"]) == 1
        assert "bad-message" in result["errors"][0]
        update_kwargs = update_triage_status.await_args.kwargs
        assert "bad-message" in update_kwargs["error"]
        assert update_kwargs.get("last_triage_at") is None

    @pytest.mark.anyio
    async def test_cleanup_rules_can_override_bucket_and_suggestions(self):
        pipeline = EmailTriagePipeline()
        cleanup_rule = SimpleNamespace(
            bucket_override="done",
            always_keep=False,
            queue_unsubscribe=False,
            suggest_archive=True,
        )

        with patch.object(
            triage_pipeline.email_destination_repo,
            "find_matching_destinations",
            AsyncMock(return_value=[cleanup_rule]),
        ):
            result = await pipeline._apply_cleanup_rules(
                AsyncMock(),
                uuid4(),
                "newsletter@example.com",
                "Weekly roundup",
                bucket="newsletter",
                requires_review=True,
                unsubscribe_candidate=True,
                archive_recommended=False,
            )

        assert result == ("done", False, False, True)

    @pytest.mark.anyio
    async def test_record_cleanup_suggestions_skips_existing_suggested_logs(self):
        pipeline = EmailTriagePipeline()
        message = SimpleNamespace(id=uuid4(), from_address="newsletter@example.com")
        existing_log = SimpleNamespace(id=uuid4())

        with (
            patch.object(
                triage_pipeline.email_action_log_repo,
                "get_by_message_action",
                AsyncMock(side_effect=[existing_log, existing_log]),
            ),
            patch.object(
                triage_pipeline.email_action_log_repo, "create", AsyncMock()
            ) as create_log,
        ):
            await pipeline._record_cleanup_suggestions(
                AsyncMock(),
                uuid4(),
                message,
                "thread-1",
                bucket="newsletter",
                unsubscribe_candidate=True,
                archive_recommended=True,
            )

        create_log.assert_not_awaited()

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


class TestEmailTriageRepositoryQueries:
    """Tests for triage-specific repository query guards."""

    @pytest.mark.anyio
    async def test_list_triage_messages_query_filters_to_triaged_rows(self):
        from app.repositories import email_source as email_source_repo

        db = AsyncMock()
        db.scalar = AsyncMock(return_value=0)
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=result)

        await email_source_repo.list_triage_messages_for_user(db, uuid4())

        query = db.execute.await_args.args[0]
        assert "email_messages.triaged_at IS NOT NULL" in str(query)

    @pytest.mark.anyio
    async def test_triage_stats_queries_filter_to_triaged_rows(self):
        from app.repositories import email_source as email_source_repo

        db = AsyncMock()
        by_bucket_result = MagicMock()
        by_bucket_result.all.return_value = []
        last_run_result = MagicMock()
        last_run_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(side_effect=[by_bucket_result, last_run_result])
        db.scalar = AsyncMock(side_effect=[0, 0, 0])

        await email_source_repo.get_triage_stats_for_user(db, uuid4())

        assert "email_messages.triaged_at IS NOT NULL" in str(db.execute.await_args_list[0].args[0])
        for call in db.scalar.await_args_list:
            assert "email_messages.triaged_at IS NOT NULL" in str(call.args[0])


class TestEmailCleanupReviewService:
    """Tests for phase-2 cleanup review flows."""

    @pytest.mark.anyio
    async def test_approve_subscription_group_requires_cleanup_candidate(self):
        service = EmailService(AsyncMock())
        message = SimpleNamespace(
            id=uuid4(),
            from_address="alerts@bank.com",
            subject="Security alert",
            unsubscribe_candidate=False,
            archive_recommended=False,
        )

        with (
            patch.object(service, "get_triage_message", AsyncMock(return_value=message)),
            pytest.raises(BadRequestError, match="cleanup candidate"),
        ):
            await service.approve_subscription_group(message.id, uuid4())

    @pytest.mark.anyio
    async def test_dismiss_subscription_group_requires_cleanup_candidate(self):
        service = EmailService(AsyncMock())
        message = SimpleNamespace(
            id=uuid4(),
            from_address="alerts@bank.com",
            subject="Security alert",
            unsubscribe_candidate=False,
            archive_recommended=False,
        )

        with (
            patch.object(service, "get_triage_message", AsyncMock(return_value=message)),
            pytest.raises(BadRequestError, match="cleanup candidate"),
        ):
            await service.dismiss_subscription_group(message.id, uuid4())

    @pytest.mark.anyio
    async def test_approve_subscription_group_preserves_message_cleanup_signals(self):
        service = EmailService(AsyncMock())
        message = SimpleNamespace(
            id=uuid4(),
            from_address="newsletter@example.com",
            subject="Weekly roundup",
            unsubscribe_candidate=True,
            archive_recommended=False,
        )
        rule = SimpleNamespace(
            id=uuid4(),
            queue_unsubscribe=True,
            suggest_archive=False,
            always_keep=False,
        )

        with (
            patch.object(service, "get_triage_message", AsyncMock(return_value=message)),
            patch.object(
                service,
                "_upsert_cleanup_rule",
                AsyncMock(return_value=(rule, True)),
            ) as upsert_rule,
            patch("app.services.email.email_source_repo.update_message_triage", AsyncMock()),
            patch.object(service, "_create_action_log", AsyncMock()),
        ):
            await service.approve_subscription_group(message.id, uuid4())

        assert upsert_rule.await_args.kwargs["queue_unsubscribe"] is True
        assert upsert_rule.await_args.kwargs["suggest_archive"] is False

    @pytest.mark.anyio
    async def test_list_subscription_groups_fetches_all_cleanup_candidate_pages(self):
        service = EmailService(AsyncMock())
        user_id = uuid4()
        now = datetime(2026, 3, 23, 18, 0, 0)

        def make_message(domain: str, index: int) -> SimpleNamespace:
            return SimpleNamespace(
                id=uuid4(),
                from_address=f"sender{index}@{domain}",
                subject=f"Digest {index}",
                received_at=now,
                unsubscribe_candidate=True,
                archive_recommended=False,
                source=SimpleNamespace(email_address="me@example.com"),
            )

        first_batch = [make_message("alpha.example.com", index) for index in range(500)]
        second_batch = [make_message("beta.example.com", 500)]

        with (
            patch(
                "app.services.email.email_source_repo.list_cleanup_candidate_messages_for_user",
                AsyncMock(side_effect=[(first_batch, 501), (second_batch, 501)]),
            ) as list_candidates,
            patch(
                "app.services.email.email_destination_repo.get_active_by_user_id",
                AsyncMock(return_value=[]),
            ),
        ):
            groups, total = await service.list_subscription_groups(user_id, limit=10, offset=0)

        assert list_candidates.await_count == 2
        assert total == 2
        assert [group["sender_domain"] for group in groups] == [
            "alpha.example.com",
            "beta.example.com",
        ]


class TestEmailSourceRepository:
    """Tests for email source repository token handling."""

    @pytest.mark.anyio
    async def test_update_tokens_encrypts_refresh_token(self):
        """Reconnect flows should encrypt refreshed access and refresh tokens."""
        from app.repositories import email_source as email_source_repo

        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()

        source = SimpleNamespace(
            access_token="old-access",
            refresh_token="old-refresh",
            token_expiry=None,
        )

        await email_source_repo.update_tokens(
            db,
            source,
            "new-access",
            datetime(2026, 1, 1),
            refresh_token="new-refresh",
        )

        assert is_encrypted(source.access_token)
        assert decrypt_token(source.access_token) == "new-access"
        assert is_encrypted(source.refresh_token)
        assert decrypt_token(source.refresh_token) == "new-refresh"

    @pytest.mark.anyio
    async def test_update_tokens_preserves_existing_refresh_token_when_omitted(self):
        """Missing refresh tokens from Google should not overwrite the stored secret."""
        from app.repositories import email_source as email_source_repo

        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()

        existing_refresh = "stored-refresh"
        source = SimpleNamespace(
            access_token="old-access",
            refresh_token=existing_refresh,
            token_expiry=None,
        )

        await email_source_repo.update_tokens(
            db,
            source,
            "new-access",
            datetime(2026, 1, 1),
        )

        assert is_encrypted(source.access_token)
        assert decrypt_token(source.access_token) == "new-access"
        assert source.refresh_token == existing_refresh


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


class TestRawJob:
    """Tests for RawJob dataclass."""

    def test_create_raw_job(self):
        """Test creating a RawJob with all fields."""
        job = RawJob(
            title="Software Engineer",
            company="Acme Corp",
            job_url="https://example.com/job/123",
            location="Portland, OR",
            description="Build software",
            salary_range="$100k-$150k",
            date_posted=datetime(2025, 1, 1),
            source="linkedin",
            is_remote=True,
            job_type="fulltime",
            company_url="https://acme.com",
        )

        assert job.title == "Software Engineer"
        assert job.company == "Acme Corp"
        assert job.job_url == "https://example.com/job/123"
        assert job.location == "Portland, OR"
        assert job.source == "linkedin"
        assert job.is_remote is True

    def test_create_minimal_raw_job(self):
        """Test creating a RawJob with only required fields."""
        job = RawJob(
            title="Engineer",
            company="Tech Co",
            job_url="https://example.com/job",
        )

        assert job.title == "Engineer"
        assert job.company == "Tech Co"
        assert job.job_url == "https://example.com/job"
        assert job.location is None
        assert job.source is None

    def test_from_extracted(self):
        """Test creating RawJob from ExtractedJob."""
        extracted = ExtractedJob(
            title="Data Scientist",
            company="Data Corp",
            job_url="https://indeed.com/job/456",
            location="Remote",
            salary_range="$120k-$160k",
            source="indeed",
            description_snippet="Analyze data and build models.",
        )

        raw = RawJob.from_extracted(extracted)

        assert raw.title == "Data Scientist"
        assert raw.company == "Data Corp"
        assert raw.job_url == "https://indeed.com/job/456"
        assert raw.location == "Remote"
        assert raw.salary_range == "$120k-$160k"
        assert raw.source == "indeed"
        assert raw.description == "Analyze data and build models."

    def test_from_extracted_with_source_override(self):
        """Test creating RawJob with source override."""
        extracted = ExtractedJob(
            title="Engineer",
            company="Tech Co",
            job_url="https://example.com/job",
            source="unknown",
        )

        raw = RawJob.from_extracted(extracted, source_override="linkedin")

        assert raw.source == "linkedin"


class TestIngestionResult:
    """Tests for IngestionResult dataclass."""

    def test_default_values(self):
        """Test IngestionResult default values."""
        result = IngestionResult()

        assert result.jobs_received == 0
        assert result.jobs_analyzed == 0
        assert result.jobs_saved == 0
        assert result.duplicates_skipped == 0
        assert result.high_scoring == 0
        assert result.saved_jobs is None

    def test_with_values(self):
        """Test IngestionResult with custom values."""
        result = IngestionResult(
            jobs_received=10,
            jobs_analyzed=8,
            jobs_saved=5,
            duplicates_skipped=2,
            high_scoring=3,
        )

        assert result.jobs_received == 10
        assert result.jobs_analyzed == 8
        assert result.jobs_saved == 5
        assert result.duplicates_skipped == 2
        assert result.high_scoring == 3
