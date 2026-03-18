"""Tests for job-related helper logic and pipeline registration."""

from app.pipelines.actions.job_prep.answer_generator import categorize_question


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


class TestJobPipelineRegistration:
    """Tests for job-related pipeline registration."""

    def setup_method(self):
        """Initialize pipelines before each test."""
        from app.pipelines.actions import discover_pipelines
        from app.pipelines.registry import clear_registry

        clear_registry()
        discover_pipelines(force_reload=True)

    def test_job_prep_pipeline_registered(self):
        """Test that job_prep pipeline is registered."""
        from app.pipelines.registry import get_pipeline

        pipeline = get_pipeline("job_prep")
        assert pipeline is not None
        assert pipeline.name == "job_prep"
        assert pipeline.area == "jobs"

    def test_job_prep_has_new_inputs(self):
        """Test job_prep pipeline has expected inputs."""
        from app.pipelines.registry import get_pipeline_info

        info = get_pipeline_info("job_prep")
        assert info is not None
        props = info["input_schema"]["properties"]
        assert "generate_screening_answers" in props
        assert "auto_analyze" not in props

    def test_job_prep_output_includes_screening_answers(self):
        """Test job_prep output schema exposes screening answers from the main pass."""
        from app.pipelines.registry import get_pipeline_info

        info = get_pipeline_info("job_prep")
        assert info is not None
        props = info["output_schema"]["properties"]
        assert "screening_answers" in props
