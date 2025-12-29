"""Tests for browser automation module."""

from app.browser.extractors import (
    ApplicationType,
    FieldType,
    FormField,
    ScreeningQuestion,
    _map_field_type,
)
from app.pipelines.actions.job_prep.answer_generator import categorize_question


class TestFieldType:
    """Tests for field type mapping."""

    def test_map_text_field(self):
        """Test mapping text input type."""
        assert _map_field_type("text") == FieldType.TEXT

    def test_map_email_field(self):
        """Test mapping email input type."""
        assert _map_field_type("email") == FieldType.EMAIL

    def test_map_phone_field(self):
        """Test mapping phone/tel input type."""
        assert _map_field_type("tel") == FieldType.PHONE

    def test_map_textarea(self):
        """Test mapping textarea."""
        assert _map_field_type("textarea") == FieldType.TEXTAREA

    def test_map_file_field(self):
        """Test mapping file input type."""
        assert _map_field_type("file") == FieldType.FILE

    def test_map_unknown_field(self):
        """Test mapping unknown input type."""
        assert _map_field_type("custom") == FieldType.UNKNOWN

    def test_map_case_insensitive(self):
        """Test that mapping is case insensitive."""
        assert _map_field_type("TEXT") == FieldType.TEXT
        assert _map_field_type("Email") == FieldType.EMAIL


class TestFormField:
    """Tests for FormField dataclass."""

    def test_form_field_creation(self):
        """Test creating a form field."""
        field = FormField(
            name="email",
            field_type=FieldType.EMAIL,
            label="Email Address",
            required=True,
        )
        assert field.name == "email"
        assert field.field_type == FieldType.EMAIL
        assert field.required is True

    def test_form_field_to_dict(self):
        """Test converting form field to dictionary."""
        field = FormField(
            name="cover_letter",
            field_type=FieldType.TEXTAREA,
            label="Cover Letter",
            required=False,
            placeholder="Tell us about yourself...",
        )
        d = field.to_dict()
        assert d["name"] == "cover_letter"
        assert d["field_type"] == "textarea"
        assert d["required"] is False
        assert d["placeholder"] == "Tell us about yourself..."


class TestScreeningQuestion:
    """Tests for ScreeningQuestion dataclass."""

    def test_screening_question_creation(self):
        """Test creating a screening question."""
        question = ScreeningQuestion(
            question="Are you authorized to work in the US?",
            field_type=FieldType.RADIO,
            required=True,
            options=["Yes", "No"],
        )
        assert question.question == "Are you authorized to work in the US?"
        assert question.required is True
        assert len(question.options) == 2

    def test_screening_question_to_dict(self):
        """Test converting screening question to dictionary."""
        question = ScreeningQuestion(
            question="Years of experience with Python?",
            field_type=FieldType.SELECT,
            options=["0-2", "3-5", "5+"],
        )
        d = question.to_dict()
        assert d["question"] == "Years of experience with Python?"
        assert d["field_type"] == "select"
        assert len(d["options"]) == 3


class TestQuestionCategorization:
    """Tests for screening question categorization."""

    def test_categorize_work_authorization(self):
        """Test categorizing work authorization questions."""
        assert categorize_question("Are you authorized to work in the US?") == "work_authorization"
        assert categorize_question("Do you require visa sponsorship?") == "work_authorization"

    def test_categorize_experience(self):
        """Test categorizing experience questions."""
        assert (
            categorize_question("How many years of experience do you have?") == "years_experience"
        )
        assert categorize_question("Years of experience with Python?") == "years_experience"

    def test_categorize_relocation(self):
        """Test categorizing relocation questions."""
        assert categorize_question("Are you willing to relocate?") == "relocation"
        assert categorize_question("Are you open to relocation?") == "relocation"

    def test_categorize_start_date(self):
        """Test categorizing start date questions."""
        assert categorize_question("What is your earliest start date?") == "start_date"
        assert categorize_question("When can you start?") == "start_date"

    def test_categorize_salary(self):
        """Test categorizing salary questions."""
        assert categorize_question("What is your salary expectation?") == "salary"
        assert categorize_question("What are your compensation expectations?") == "salary"

    def test_categorize_unknown(self):
        """Test that unknown questions return None."""
        assert categorize_question("What is your favorite color?") is None
        assert categorize_question("Describe yourself in 3 words") is None


class TestApplicationType:
    """Tests for ApplicationType enum."""

    def test_application_type_values(self):
        """Test that all expected application types exist."""
        assert ApplicationType.EASY_APPLY.value == "easy_apply"
        assert ApplicationType.ATS.value == "ats"
        assert ApplicationType.DIRECT.value == "direct"
        assert ApplicationType.EMAIL.value == "email"
        assert ApplicationType.UNKNOWN.value == "unknown"


# =============================================================================
# Pipeline Registration Tests
# =============================================================================


class TestJobPipelineRegistration:
    """Tests for job-related pipeline registration."""

    def setup_method(self):
        """Initialize pipelines before each test."""
        from app.pipelines.actions import discover_pipelines
        from app.pipelines.registry import clear_registry

        clear_registry()
        discover_pipelines(force_reload=True)

    def test_job_apply_pipeline_registered(self):
        """Test that job_apply pipeline is registered."""
        from app.pipelines.registry import get_pipeline

        pipeline = get_pipeline("job_apply")
        assert pipeline is not None
        assert pipeline.name == "job_apply"
        assert pipeline.area == "jobs"
        assert "automation" in pipeline.tags

    def test_job_prep_pipeline_registered(self):
        """Test that job_prep pipeline is registered."""
        from app.pipelines.registry import get_pipeline

        pipeline = get_pipeline("job_prep")
        assert pipeline is not None
        assert pipeline.name == "job_prep"
        assert pipeline.area == "jobs"

    def test_job_apply_input_schema(self):
        """Test job_apply pipeline has correct input schema."""
        from app.pipelines.registry import get_pipeline_info

        info = get_pipeline_info("job_apply")
        assert info is not None
        assert "properties" in info["input_schema"]
        assert "job_id" in info["input_schema"]["properties"]
        assert "mode" in info["input_schema"]["properties"]
        assert "dry_run" in info["input_schema"]["properties"]

    def test_job_prep_has_new_inputs(self):
        """Test job_prep pipeline has expected inputs."""
        from app.pipelines.registry import get_pipeline_info

        info = get_pipeline_info("job_prep")
        assert info is not None
        props = info["input_schema"]["properties"]
        assert "generate_screening_answers" in props
        assert "auto_analyze" in props
