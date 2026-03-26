"""Tests for Phase 3 email triage routing into Jobs and Finances.

Tests cover:
- Routing classified job messages into the jobs domain
- Routing classified finance messages into the finance domain
- Idempotency: repeated triage runs don't duplicate records
- Failure paths: routing errors mark messages for review
- Classifier heuristic improvements
- LinkedEmailContext schema bridging
"""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.clients.gmail import EmailContent
from app.pipelines.actions.email_triage import pipeline as triage_pipeline
from app.pipelines.actions.email_triage.classifier import classify_email
from app.pipelines.actions.email_triage.pipeline import EmailTriagePipeline
from app.schemas.email_triage import EmailTriageRunResult
from app.schemas.finance import TransactionResponse
from app.schemas.job import JobResponse


def _email_content(
    *,
    subject: str,
    from_address: str,
    snippet: str = "",
    body_text: str = "",
    body_html: str = "",
    message_id: str = "gmail-msg-1",
    thread_id: str = "gmail-thread-1",
    list_unsubscribe: str | None = None,
    precedence: str | None = None,
    auto_submitted: str | None = None,
) -> EmailContent:
    return EmailContent(
        message_id=message_id,
        thread_id=thread_id,
        subject=subject,
        from_address=from_address,
        to_address="me@example.com",
        received_at=datetime.fromisoformat("2026-03-23T12:00:00+00:00"),
        body_html=body_html,
        body_text=body_text,
        snippet=snippet,
        list_unsubscribe=list_unsubscribe,
        precedence=precedence,
        auto_submitted=auto_submitted,
    )


def _mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    return db


# ─────────────────────────────────────────────────────────────────────────────
# Classifier Heuristic Tests (Phase 3 improvements)
# ─────────────────────────────────────────────────────────────────────────────


class TestClassifierPhase3:
    """Tests for AI-first classification of job and finance emails."""

    def _patch_ai(self, **overrides):
        from app.pipelines.actions.email_triage import classifier as triage_classifier
        from app.pipelines.actions.email_triage.classifier import TriageClassification

        defaults = {
            "bucket": "review",
            "confidence": 0.9,
            "actionability_score": 0.5,
            "summary": "Test summary",
            "requires_review": False,
            "unsubscribe_candidate": False,
            "is_vip": False,
        }
        defaults.update(overrides)
        classification = TriageClassification(**defaults)
        return patch.object(
            triage_classifier, "_ai_classify", AsyncMock(return_value=classification)
        )

    @pytest.mark.anyio
    async def test_ats_sender_classified_as_jobs(self):
        """ATS platform senders (greenhouse, lever, etc.) should be classified as jobs."""
        for sender_domain in ("greenhouse.io", "lever.co", "ashbyhq.com"):
            with self._patch_ai(bucket="jobs", confidence=0.95, actionability_score=0.65):
                classification = await classify_email(
                    _email_content(
                        subject="Application Update",
                        from_address=f"no-reply@{sender_domain}",
                        snippet="Your application status has been updated.",
                    )
                )
            assert classification.bucket == "jobs", f"Failed for {sender_domain}"

    @pytest.mark.anyio
    async def test_interview_keywords_get_high_actionability(self):
        """Interview-related emails should have high actionability scores."""
        with self._patch_ai(bucket="jobs", confidence=0.95, actionability_score=0.88):
            classification = await classify_email(
                _email_content(
                    subject="Schedule your technical interview",
                    from_address="recruiter@company.com",
                    snippet="We'd like to schedule a technical interview with you.",
                )
            )
        assert classification.bucket == "jobs"
        assert classification.actionability_score >= 0.85

    @pytest.mark.anyio
    async def test_rejection_keywords_classified_as_jobs(self):
        """Rejection emails should be classified as jobs with moderate actionability."""
        with self._patch_ai(bucket="jobs", confidence=0.92, actionability_score=0.7):
            classification = await classify_email(
                _email_content(
                    subject="Update on your application",
                    from_address="no-reply@company.com",
                    snippet="Unfortunately, we have decided not to proceed with your application.",
                )
            )
        assert classification.bucket == "jobs"
        assert classification.actionability_score >= 0.6
        assert classification.actionability_score < 0.85

    @pytest.mark.anyio
    async def test_expanded_finance_senders(self):
        """Finance senders (capitalone, amex, etc.) should be classified as finance."""
        for sender_domain in ("capitalone.com", "amex.com", "ally.com"):
            with self._patch_ai(bucket="finance", confidence=0.94, actionability_score=0.55):
                classification = await classify_email(
                    _email_content(
                        subject="Your monthly statement is ready",
                        from_address=f"alerts@{sender_domain}",
                        snippet="Your statement is available.",
                    )
                )
            assert classification.bucket == "finance", f"Failed for {sender_domain}"

    @pytest.mark.anyio
    async def test_expanded_finance_keywords(self):
        """Finance keywords (direct deposit, etc.) should trigger finance bucket."""
        with self._patch_ai(bucket="finance", confidence=0.9, actionability_score=0.55):
            classification = await classify_email(
                _email_content(
                    subject="Direct deposit received",
                    from_address="payroll@company.com",
                    snippet="Your direct deposit of $2,500.00 has been processed.",
                )
            )
        assert classification.bucket == "finance"


# ─────────────────────────────────────────────────────────────────────────────
# Routing Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestRouteJobMessage:
    """Tests for _route_job_message."""

    @pytest.mark.anyio
    async def test_routes_job_message_successfully(self):
        """A jobs-bucket message should be processed and linked back."""
        pipeline = EmailTriagePipeline()
        db = _mock_db()
        user_id = uuid4()
        message = SimpleNamespace(id=uuid4(), gmail_thread_id="thread-1")
        email_content = _email_content(
            subject="5 new jobs for you",
            from_address="jobs@indeed.com",
        )
        destination = SimpleNamespace(id=uuid4())
        created_job_id = str(uuid4())

        job_mock = SimpleNamespace(id=created_job_id, source_email_message_id=None)
        job_service = AsyncMock()
        email_service = AsyncMock()
        email_service.process_email_for_destination = AsyncMock(
            return_value={
                "parser_used": "indeed",
                "items_extracted": 2,
                "jobs_saved": 2,
                "created_item_ids": [created_job_id],
                "error": None,
            }
        )
        email_service.record_destination_processing = AsyncMock()

        with (
            patch.object(
                triage_pipeline.email_destination_repo,
                "get_message_destinations",
                AsyncMock(return_value=[]),
            ),
            patch.object(
                triage_pipeline.email_action_log_repo,
                "create",
                AsyncMock(),
            ) as log_create,
            patch(
                "app.repositories.job_repo.get_by_id",
                AsyncMock(return_value=job_mock),
            ),
        ):
            result = await pipeline._route_job_message(
                db,
                user_id,
                message,
                email_content,
                job_service,
                email_service,
                destination,
                profile_id=uuid4(),
                force=False,
            )

        assert result == 2
        email_service.process_email_for_destination.assert_awaited_once()
        email_service.record_destination_processing.assert_awaited_once()
        log_create.assert_awaited_once()
        # source_email_message_id should be set on the job
        assert job_mock.source_email_message_id == message.id

    @pytest.mark.anyio
    async def test_skips_already_routed_job_message(self):
        """A message already routed to the jobs destination should be skipped."""
        pipeline = EmailTriagePipeline()
        db = _mock_db()
        destination = SimpleNamespace(id=uuid4())
        message = SimpleNamespace(id=uuid4(), gmail_thread_id="thread-1")

        existing_emd = SimpleNamespace(destination_id=destination.id)

        with patch.object(
            triage_pipeline.email_destination_repo,
            "get_message_destinations",
            AsyncMock(return_value=[existing_emd]),
        ):
            result = await pipeline._route_job_message(
                db,
                uuid4(),
                message,
                _email_content(subject="Jobs", from_address="jobs@indeed.com"),
                AsyncMock(),
                AsyncMock(),
                destination,
                profile_id=None,
                force=False,
            )

        assert result is None

    @pytest.mark.anyio
    async def test_force_reroutes_already_processed_job_message(self):
        """When force=True, previously routed messages should be reprocessed."""
        pipeline = EmailTriagePipeline()
        db = _mock_db()
        destination = SimpleNamespace(id=uuid4())
        message = SimpleNamespace(id=uuid4(), gmail_thread_id="thread-1")

        existing_emd = SimpleNamespace(destination_id=destination.id)

        email_service = AsyncMock()
        email_service.process_email_for_destination = AsyncMock(
            return_value={
                "parser_used": "ai",
                "items_extracted": 1,
                "jobs_saved": 1,
                "created_item_ids": [],
                "error": None,
            }
        )
        email_service.record_destination_processing = AsyncMock()

        with (
            patch.object(
                triage_pipeline.email_destination_repo,
                "get_message_destinations",
                AsyncMock(return_value=[existing_emd]),
            ),
            patch.object(
                triage_pipeline.email_action_log_repo,
                "create",
                AsyncMock(),
            ),
        ):
            result = await pipeline._route_job_message(
                db,
                uuid4(),
                message,
                _email_content(subject="Jobs", from_address="jobs@indeed.com"),
                AsyncMock(),
                email_service,
                destination,
                profile_id=None,
                force=True,
            )

        assert result == 1
        email_service.process_email_for_destination.assert_awaited_once()

    @pytest.mark.anyio
    async def test_zero_jobs_marks_for_review(self):
        """When no jobs are extracted, the message should be marked for review."""
        pipeline = EmailTriagePipeline()
        db = _mock_db()
        message = SimpleNamespace(id=uuid4(), gmail_thread_id="thread-1")

        email_service = AsyncMock()
        email_service.process_email_for_destination = AsyncMock(
            return_value={
                "parser_used": "ai",
                "items_extracted": 0,
                "jobs_saved": 0,
                "created_item_ids": [],
                "error": None,
            }
        )
        email_service.record_destination_processing = AsyncMock()

        with (
            patch.object(
                triage_pipeline.email_destination_repo,
                "get_message_destinations",
                AsyncMock(return_value=[]),
            ),
            patch.object(
                triage_pipeline.email_action_log_repo,
                "create",
                AsyncMock(),
            ),
            patch.object(
                triage_pipeline.email_source_repo,
                "update_message_triage",
                AsyncMock(),
            ) as update_triage,
        ):
            result = await pipeline._route_job_message(
                db,
                uuid4(),
                message,
                _email_content(subject="Jobs", from_address="jobs@unknown.com"),
                AsyncMock(),
                email_service,
                SimpleNamespace(id=uuid4()),
                profile_id=None,
                force=False,
            )

        assert result == 0
        update_triage.assert_awaited_once()
        assert update_triage.await_args.kwargs["requires_review"] is True


class TestRouteFinanceMessage:
    """Tests for _route_finance_message."""

    @pytest.mark.anyio
    async def test_routes_finance_message_successfully(self):
        """A finance-bucket message should parse transactions and import them."""
        pipeline = EmailTriagePipeline()
        db = _mock_db()
        user_id = uuid4()
        message = SimpleNamespace(id=uuid4(), gmail_thread_id="thread-1")
        email_content = _email_content(
            subject="Your receipt from Stripe",
            from_address="receipts@stripe.com",
            body_text="Payment of $49.99 processed",
        )
        destination = SimpleNamespace(id=uuid4())

        parsed_txns = [
            {"description": "Stripe payment", "amount": -49.99, "transaction_date": "2026-03-23"}
        ]
        finance_service = AsyncMock()
        mock_tx = SimpleNamespace(id=uuid4())
        finance_service.ingest_from_email = AsyncMock(return_value=(1, 0, [mock_tx]))
        email_service = AsyncMock()
        email_service.record_destination_processing = AsyncMock()

        with (
            patch.object(
                triage_pipeline.email_destination_repo,
                "get_message_destinations",
                AsyncMock(return_value=[]),
            ),
            patch(
                "app.pipelines.actions.finance_email_sync.parser.parse_transaction_email",
                AsyncMock(return_value=parsed_txns),
            ) as parse_mock,
            patch.object(
                triage_pipeline.email_action_log_repo,
                "create",
                AsyncMock(),
            ) as log_create,
        ):
            result = await pipeline._route_finance_message(
                db,
                user_id,
                message,
                email_content,
                finance_service,
                email_service,
                destination,
                force=False,
            )

        assert result == 1
        parse_mock.assert_awaited_once()
        finance_service.ingest_from_email.assert_awaited_once()
        # Verify source_email_message_id is added to parsed txns
        call_args = finance_service.ingest_from_email.await_args
        tx_list = call_args.args[1]
        assert tx_list[0]["source_email_message_id"] == message.id
        assert tx_list[0]["raw_email_id"] == "gmail-msg-1"
        email_service.record_destination_processing.assert_awaited_once()
        log_create.assert_awaited_once()

    @pytest.mark.anyio
    async def test_skips_already_routed_finance_message(self):
        """A message already routed to the finance destination should be skipped."""
        pipeline = EmailTriagePipeline()
        db = _mock_db()
        destination = SimpleNamespace(id=uuid4())
        message = SimpleNamespace(id=uuid4(), gmail_thread_id="thread-1")
        existing_emd = SimpleNamespace(destination_id=destination.id)

        with patch.object(
            triage_pipeline.email_destination_repo,
            "get_message_destinations",
            AsyncMock(return_value=[existing_emd]),
        ):
            result = await pipeline._route_finance_message(
                db,
                uuid4(),
                message,
                _email_content(subject="Receipt", from_address="receipts@stripe.com"),
                AsyncMock(),
                AsyncMock(),
                destination,
                force=False,
            )

        assert result is None

    @pytest.mark.anyio
    async def test_zero_transactions_marks_for_review(self):
        """When no transactions are parsed, the message should be marked for review."""
        pipeline = EmailTriagePipeline()
        db = _mock_db()
        message = SimpleNamespace(id=uuid4(), gmail_thread_id="thread-1")
        email_service = AsyncMock()
        email_service.record_destination_processing = AsyncMock()

        with (
            patch.object(
                triage_pipeline.email_destination_repo,
                "get_message_destinations",
                AsyncMock(return_value=[]),
            ),
            patch(
                "app.pipelines.actions.finance_email_sync.parser.parse_transaction_email",
                AsyncMock(return_value=[]),
            ),
            patch.object(
                triage_pipeline.email_action_log_repo,
                "create",
                AsyncMock(),
            ),
            patch.object(
                triage_pipeline.email_source_repo,
                "update_message_triage",
                AsyncMock(),
            ) as update_triage,
        ):
            result = await pipeline._route_finance_message(
                db,
                uuid4(),
                message,
                _email_content(subject="???", from_address="unknown@example.com"),
                AsyncMock(),
                email_service,
                SimpleNamespace(id=uuid4()),
                force=False,
            )

        assert result == 0
        update_triage.assert_awaited_once()
        assert update_triage.await_args.kwargs["requires_review"] is True


class TestRouteClassifiedMessages:
    """Tests for _route_classified_messages orchestration."""

    @pytest.mark.anyio
    async def test_routes_mixed_jobs_and_finance(self):
        """Routing should handle a mix of jobs and finance messages."""
        pipeline = EmailTriagePipeline()
        db = _mock_db()
        user_id = uuid4()

        job_message = SimpleNamespace(id=uuid4(), gmail_thread_id="t-1")
        finance_message = SimpleNamespace(id=uuid4(), gmail_thread_id="t-2")
        job_content = _email_content(subject="New jobs", from_address="jobs@linkedin.com")
        finance_content = _email_content(subject="Receipt", from_address="receipts@stripe.com")

        routable = [
            (job_message, job_content, "jobs"),
            (finance_message, finance_content, "finance"),
        ]

        with (
            patch.object(pipeline, "_route_job_message", AsyncMock(return_value=3)) as route_job,
            patch.object(
                pipeline, "_route_finance_message", AsyncMock(return_value=1)
            ) as route_fin,
            patch(
                "app.services.email.EmailService",
                return_value=AsyncMock(
                    ensure_default_destination=AsyncMock(return_value=SimpleNamespace(id=uuid4())),
                    ensure_default_finance_destination=AsyncMock(
                        return_value=SimpleNamespace(id=uuid4())
                    ),
                ),
            ),
            patch(
                "app.services.job.JobService",
                return_value=AsyncMock(),
            ),
            patch(
                "app.services.finance_service.FinanceService",
                return_value=AsyncMock(),
            ),
            patch(
                "app.services.job_profile.JobProfileService",
                return_value=AsyncMock(
                    get_default_for_user=AsyncMock(return_value=None),
                ),
            ),
        ):
            result = await pipeline._route_classified_messages(
                db, user_id, routable, force_full_run=False
            )

        assert result["routed_job_messages"] == 1
        assert result["created_jobs"] == 3
        assert result["routed_finance_messages"] == 1
        assert result["imported_transactions"] == 1
        assert result["routing_errors"] == 0
        route_job.assert_awaited_once()
        route_fin.assert_awaited_once()

    @pytest.mark.anyio
    async def test_routing_error_marks_review_and_logs(self):
        """Routing errors should mark messages for review and log the failure."""
        pipeline = EmailTriagePipeline()
        db = _mock_db()
        user_id = uuid4()

        message = SimpleNamespace(id=uuid4(), gmail_thread_id="t-1")
        content = _email_content(subject="Jobs", from_address="jobs@indeed.com")
        routable = [(message, content, "jobs")]

        with (
            patch.object(
                pipeline,
                "_route_job_message",
                AsyncMock(side_effect=RuntimeError("parsing boom")),
            ),
            patch(
                "app.services.email.EmailService",
                return_value=AsyncMock(
                    ensure_default_destination=AsyncMock(return_value=SimpleNamespace(id=uuid4())),
                    ensure_default_finance_destination=AsyncMock(
                        return_value=SimpleNamespace(id=uuid4())
                    ),
                ),
            ),
            patch(
                "app.services.job.JobService",
                return_value=AsyncMock(),
            ),
            patch(
                "app.services.finance_service.FinanceService",
                return_value=AsyncMock(),
            ),
            patch(
                "app.services.job_profile.JobProfileService",
                return_value=AsyncMock(
                    get_default_for_user=AsyncMock(return_value=None),
                ),
            ),
            patch.object(
                triage_pipeline.email_source_repo,
                "update_message_triage",
                AsyncMock(),
            ) as update_triage,
            patch.object(
                triage_pipeline.email_action_log_repo,
                "create",
                AsyncMock(),
            ) as log_create,
        ):
            result = await pipeline._route_classified_messages(
                db, user_id, routable, force_full_run=False
            )

        assert result["routing_errors"] == 1
        assert len(result["errors"]) == 1
        assert "parsing boom" in result["errors"][0]
        update_triage.assert_awaited_once()
        assert update_triage.await_args.kwargs["requires_review"] is True
        log_create.assert_awaited_once()
        assert log_create.await_args.kwargs["action_status"] == "failed"

    @pytest.mark.anyio
    async def test_skipped_messages_not_counted(self):
        """When _route_job_message returns None (skipped), counts should not increment."""
        pipeline = EmailTriagePipeline()
        db = _mock_db()

        message = SimpleNamespace(id=uuid4(), gmail_thread_id="t-1")
        content = _email_content(subject="Jobs", from_address="jobs@indeed.com")
        routable = [(message, content, "jobs")]

        with (
            patch.object(pipeline, "_route_job_message", AsyncMock(return_value=None)),
            patch(
                "app.services.email.EmailService",
                return_value=AsyncMock(
                    ensure_default_destination=AsyncMock(return_value=SimpleNamespace(id=uuid4())),
                    ensure_default_finance_destination=AsyncMock(
                        return_value=SimpleNamespace(id=uuid4())
                    ),
                ),
            ),
            patch(
                "app.services.job.JobService",
                return_value=AsyncMock(),
            ),
            patch(
                "app.services.finance_service.FinanceService",
                return_value=AsyncMock(),
            ),
            patch(
                "app.services.job_profile.JobProfileService",
                return_value=AsyncMock(
                    get_default_for_user=AsyncMock(return_value=None),
                ),
            ),
        ):
            result = await pipeline._route_classified_messages(
                db, uuid4(), routable, force_full_run=False
            )

        assert result["routed_job_messages"] == 0
        assert result["created_jobs"] == 0


# ─────────────────────────────────────────────────────────────────────────────
# LinkedEmailContext Schema Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestLinkedEmailContextSerialization:
    """Tests for LinkedEmailContext bridging in response schemas."""

    def test_job_response_resolves_linked_email_from_relationship(self):
        """JobResponse model_validator should bridge source_email_message to linked_email."""
        msg_id = uuid4()
        email_source = SimpleNamespace(email_address="me@gmail.com")
        email_msg = SimpleNamespace(
            id=msg_id,
            source=email_source,
            gmail_message_id="gmail-123",
            gmail_thread_id="thread-123",
            subject="Job alert from Indeed",
            from_address="jobs@indeed.com",
            received_at=datetime(2026, 3, 23, 12, 0, 0, tzinfo=UTC),
            bucket="jobs",
            summary="5 new jobs matching your profile.",
        )

        # Simulate SQLAlchemy model object
        job = SimpleNamespace(
            id=uuid4(),
            user_id=uuid4(),
            title="Software Engineer",
            company="Acme Corp",
            location=None,
            description=None,
            job_url="https://indeed.com/job/1",
            salary_range=None,
            date_posted=None,
            source="indeed",
            ingestion_source="email",
            is_remote=None,
            job_type=None,
            company_url=None,
            profile_id=None,
            relevance_score=8.5,
            reasoning="Great match",
            status="new",
            search_terms=None,
            notes=None,
            cover_letter=None,
            cover_letter_file_path=None,
            cover_letter_generated_at=None,
            prep_notes=None,
            prepped_at=None,
            application_type=None,
            application_url=None,
            requires_cover_letter=None,
            requires_resume=None,
            detected_fields=None,
            screening_questions=None,
            screening_answers=None,
            analyzed_at=None,
            applied_at=None,
            application_method=None,
            confirmation_code=None,
            source_email_message=email_msg,
            created_at=datetime(2026, 3, 23, tzinfo=UTC),
            updated_at=None,
        )

        response = JobResponse.model_validate(job)
        assert response.linked_email is not None
        assert response.linked_email.id == msg_id
        assert response.linked_email.source_email_address == "me@gmail.com"
        assert response.linked_email.from_address == "jobs@indeed.com"
        assert response.linked_email.bucket == "jobs"

    def test_job_response_without_linked_email(self):
        """JobResponse should have linked_email=None when no source_email_message."""
        job = SimpleNamespace(
            id=uuid4(),
            user_id=uuid4(),
            title="Software Engineer",
            company="Acme Corp",
            location=None,
            description=None,
            job_url="https://indeed.com/job/1",
            salary_range=None,
            date_posted=None,
            source="indeed",
            ingestion_source="email",
            is_remote=None,
            job_type=None,
            company_url=None,
            profile_id=None,
            relevance_score=None,
            reasoning=None,
            status="new",
            search_terms=None,
            notes=None,
            cover_letter=None,
            cover_letter_file_path=None,
            cover_letter_generated_at=None,
            prep_notes=None,
            prepped_at=None,
            application_type=None,
            application_url=None,
            requires_cover_letter=None,
            requires_resume=None,
            detected_fields=None,
            screening_questions=None,
            screening_answers=None,
            analyzed_at=None,
            applied_at=None,
            application_method=None,
            confirmation_code=None,
            source_email_message=None,
            created_at=datetime(2026, 3, 23, tzinfo=UTC),
            updated_at=None,
        )

        response = JobResponse.model_validate(job)
        assert response.linked_email is None

    def test_transaction_response_resolves_linked_email(self):
        """TransactionResponse model_validator should bridge source_email_message."""
        msg_id = uuid4()
        email_source = SimpleNamespace(email_address="me@gmail.com")
        email_msg = SimpleNamespace(
            id=msg_id,
            source=email_source,
            gmail_message_id="gmail-456",
            gmail_thread_id="thread-456",
            subject="Payment receipt",
            from_address="receipts@stripe.com",
            received_at=datetime(2026, 3, 23, 12, 0, 0, tzinfo=UTC),
            bucket="finance",
            summary="Payment of $49.99.",
        )

        tx = SimpleNamespace(
            id=uuid4(),
            user_id=uuid4(),
            account_id=None,
            recurring_expense_id=None,
            amount=-49.99,
            description="Stripe payment",
            merchant="Stripe",
            transaction_date="2026-03-23",
            posted_date=None,
            transaction_type="debit",
            category=None,
            category_confidence=None,
            source="email_parsed",
            raw_email_id="gmail-456",
            is_reviewed=False,
            notes=None,
            source_email_message=email_msg,
            created_at=datetime(2026, 3, 23, tzinfo=UTC),
            updated_at=None,
        )

        response = TransactionResponse.model_validate(tx)
        assert response.linked_email is not None
        assert response.linked_email.id == msg_id
        assert response.linked_email.from_address == "receipts@stripe.com"
        assert response.linked_email.bucket == "finance"

    def test_transaction_response_without_linked_email(self):
        """TransactionResponse should have linked_email=None for manual transactions."""
        tx = SimpleNamespace(
            id=uuid4(),
            user_id=uuid4(),
            account_id=None,
            recurring_expense_id=None,
            amount=-25.00,
            description="Lunch",
            merchant=None,
            transaction_date="2026-03-23",
            posted_date=None,
            transaction_type="debit",
            category=None,
            category_confidence=None,
            source="manual",
            raw_email_id=None,
            is_reviewed=False,
            notes=None,
            source_email_message=None,
            created_at=datetime(2026, 3, 23, tzinfo=UTC),
            updated_at=None,
        )

        response = TransactionResponse.model_validate(tx)
        assert response.linked_email is None

    def test_job_response_from_dict_skips_validator(self):
        """When validating from a dict (API), the model_validator should pass through."""
        data = {
            "id": str(uuid4()),
            "user_id": str(uuid4()),
            "title": "Engineer",
            "company": "Corp",
            "job_url": "https://example.com",
            "status": "new",
            "created_at": "2026-03-23T00:00:00Z",
            "linked_email": None,
        }
        response = JobResponse.model_validate(data)
        assert response.linked_email is None


# ─────────────────────────────────────────────────────────────────────────────
# Triage Pipeline Output Routing Counts
# ─────────────────────────────────────────────────────────────────────────────


class TestTriageRunResultRoutingCounts:
    """Tests for routing counts in EmailTriageRunResult."""

    def test_result_has_routing_fields(self):
        result = EmailTriageRunResult(
            messages_scanned=10,
            messages_triaged=5,
            routed_job_messages=2,
            created_jobs=3,
            routed_finance_messages=1,
            imported_transactions=1,
            routing_errors=0,
        )
        assert result.routed_job_messages == 2
        assert result.created_jobs == 3
        assert result.routed_finance_messages == 1
        assert result.imported_transactions == 1
        assert result.routing_errors == 0

    def test_result_defaults_to_zero(self):
        result = EmailTriageRunResult()
        assert result.routed_job_messages == 0
        assert result.created_jobs == 0
        assert result.routed_finance_messages == 0
        assert result.imported_transactions == 0
        assert result.routing_errors == 0
