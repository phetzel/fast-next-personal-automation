"""Tests for pipeline infrastructure."""

import pytest

from app.pipelines.base import BasePipeline, PipelineResult
from app.pipelines.action_base import (
    ActionPipeline,
    ActionResult,
    PipelineContext,
    PipelineSource,
)
from app.pipelines.registry import (
    clear_registry,
    execute_pipeline,
    get_pipeline,
    get_pipeline_info,
    list_pipelines,
    register_pipeline,
)
from pydantic import BaseModel


class TestPipelineResult:
    """Tests for PipelineResult dataclass."""

    def test_success_rate_all_processed(self):
        """Test success rate when all items processed."""
        result = PipelineResult(processed=10, failed=0)
        assert result.success_rate == 100.0

    def test_success_rate_with_failures(self):
        """Test success rate with some failures."""
        result = PipelineResult(processed=8, failed=2)
        assert result.success_rate == 80.0

    def test_success_rate_all_failed(self):
        """Test success rate when all items failed."""
        result = PipelineResult(processed=0, failed=10)
        assert result.success_rate == 0.0

    def test_success_rate_empty(self):
        """Test success rate with no items."""
        result = PipelineResult(processed=0, failed=0)
        assert result.success_rate == 100.0

    def test_has_errors_with_failures(self):
        """Test has_errors returns True when failures exist."""
        result = PipelineResult(processed=5, failed=1)
        assert result.has_errors is True

    def test_has_errors_with_error_messages(self):
        """Test has_errors returns True when error messages exist."""
        result = PipelineResult(processed=5, failed=0, errors=["Error 1"])
        assert result.has_errors is True

    def test_has_errors_no_errors(self):
        """Test has_errors returns False when no errors."""
        result = PipelineResult(processed=5, failed=0)
        assert result.has_errors is False

    def test_default_values(self):
        """Test default values are set correctly."""
        result = PipelineResult(processed=5)
        assert result.failed == 0
        assert result.errors == []
        assert result.metadata == {}


class TestBasePipeline:
    """Tests for BasePipeline abstract class."""

    @pytest.mark.anyio
    async def test_validate_returns_true_by_default(self):
        """Test validate method returns True by default."""

        class TestPipeline(BasePipeline):
            async def run(self) -> PipelineResult:
                return PipelineResult(processed=0)

        pipeline = TestPipeline()
        assert await pipeline.validate() is True

    @pytest.mark.anyio
    async def test_cleanup_does_nothing_by_default(self):
        """Test cleanup method does nothing by default."""

        class TestPipeline(BasePipeline):
            async def run(self) -> PipelineResult:
                return PipelineResult(processed=0)

        pipeline = TestPipeline()
        await pipeline.cleanup()  # Should not raise

    @pytest.mark.anyio
    async def test_run_must_be_implemented(self):
        """Test that run method must be implemented by subclasses."""
        # This test verifies the abstract method requirement
        with pytest.raises(TypeError, match="Can't instantiate abstract class"):
            BasePipeline()

    @pytest.mark.anyio
    async def test_custom_pipeline_implementation(self):
        """Test a custom pipeline implementation."""

        class MyPipeline(BasePipeline):
            def __init__(self, items: list):
                self.items = items

            async def run(self) -> PipelineResult:
                processed = 0
                failed = 0
                errors = []

                for item in self.items:
                    if item > 0:
                        processed += 1
                    else:
                        failed += 1
                        errors.append(f"Invalid item: {item}")

                return PipelineResult(
                    processed=processed,
                    failed=failed,
                    errors=errors,
                )

        pipeline = MyPipeline([1, 2, 3, -1, 5])
        result = await pipeline.run()

        assert result.processed == 4
        assert result.failed == 1
        assert len(result.errors) == 1
        assert result.success_rate == 80.0


# =============================================================================
# Action Pipeline Tests
# =============================================================================


class TestActionResult:
    """Tests for ActionResult dataclass."""

    def test_success_result(self):
        """Test creating a successful result."""

        class Output(BaseModel):
            value: str

        result = ActionResult(success=True, output=Output(value="test"))
        assert result.success is True
        assert result.output.value == "test"
        assert result.error is None

    def test_failure_result(self):
        """Test creating a failure result."""
        result = ActionResult(success=False, error="Something went wrong")
        assert result.success is False
        assert result.output is None
        assert result.error == "Something went wrong"

    def test_to_dict(self):
        """Test converting result to dictionary."""

        class Output(BaseModel):
            count: int

        result = ActionResult(
            success=True,
            output=Output(count=42),
            metadata={"key": "value"},
        )
        d = result.to_dict()
        assert d["success"] is True
        assert d["output"] == {"count": 42}
        assert d["metadata"] == {"key": "value"}
        assert d["error"] is None


class TestPipelineContext:
    """Tests for PipelineContext."""

    def test_api_source(self):
        """Test creating context with API source."""
        from uuid import uuid4

        user_id = uuid4()
        ctx = PipelineContext(
            source=PipelineSource.API,
            user_id=user_id,
        )
        assert ctx.source == PipelineSource.API
        assert ctx.user_id == user_id

    def test_webhook_source(self):
        """Test creating context with webhook source."""
        ctx = PipelineContext(
            source=PipelineSource.WEBHOOK,
            metadata={"webhook_id": "123"},
        )
        assert ctx.source == PipelineSource.WEBHOOK
        assert ctx.user_id is None
        assert ctx.metadata["webhook_id"] == "123"

    def test_agent_source(self):
        """Test creating context with agent source."""
        ctx = PipelineContext(source=PipelineSource.AGENT)
        assert ctx.source == PipelineSource.AGENT


class TestPipelineRegistry:
    """Tests for pipeline registry."""

    def setup_method(self):
        """Clear registry before each test."""
        clear_registry()

    def teardown_method(self):
        """Clear registry after each test."""
        clear_registry()

    def test_register_pipeline(self):
        """Test registering a pipeline."""

        class TestInput(BaseModel):
            value: str

        class TestOutput(BaseModel):
            result: str

        @register_pipeline
        class TestPipeline(ActionPipeline[TestInput, TestOutput]):
            name = "test_pipeline"
            description = "A test pipeline"

            async def execute(
                self, input: TestInput, context: PipelineContext
            ) -> ActionResult[TestOutput]:
                return ActionResult(
                    success=True,
                    output=TestOutput(result=input.value),
                )

        pipelines = list_pipelines()
        assert len(pipelines) == 1
        assert pipelines[0]["name"] == "test_pipeline"

    def test_get_pipeline(self):
        """Test getting a pipeline by name."""

        class Input(BaseModel):
            x: int

        class Output(BaseModel):
            y: int

        @register_pipeline
        class MyPipeline(ActionPipeline[Input, Output]):
            name = "my_pipeline"
            description = "My pipeline"

            async def execute(
                self, input: Input, context: PipelineContext
            ) -> ActionResult[Output]:
                return ActionResult(success=True, output=Output(y=input.x * 2))

        pipeline = get_pipeline("my_pipeline")
        assert pipeline is not None
        assert pipeline.name == "my_pipeline"

    def test_get_nonexistent_pipeline(self):
        """Test getting a pipeline that doesn't exist."""
        pipeline = get_pipeline("nonexistent")
        assert pipeline is None

    def test_get_pipeline_info(self):
        """Test getting pipeline info with schemas."""

        class InfoInput(BaseModel):
            message: str

        class InfoOutput(BaseModel):
            echo: str

        @register_pipeline
        class InfoPipeline(ActionPipeline[InfoInput, InfoOutput]):
            name = "info_pipeline"
            description = "Pipeline with info"

            async def execute(
                self, input: InfoInput, context: PipelineContext
            ) -> ActionResult[InfoOutput]:
                return ActionResult(success=True, output=InfoOutput(echo=input.message))

        info = get_pipeline_info("info_pipeline")
        assert info is not None
        assert info["name"] == "info_pipeline"
        assert info["description"] == "Pipeline with info"
        assert "properties" in info["input_schema"]
        assert "message" in info["input_schema"]["properties"]

    @pytest.mark.anyio
    async def test_execute_pipeline(self):
        """Test executing a pipeline through the registry."""

        class ExecInput(BaseModel):
            num: int

        class ExecOutput(BaseModel):
            doubled: int

        @register_pipeline
        class ExecPipeline(ActionPipeline[ExecInput, ExecOutput]):
            name = "exec_pipeline"
            description = "Execution test"

            async def execute(
                self, input: ExecInput, context: PipelineContext
            ) -> ActionResult[ExecOutput]:
                return ActionResult(
                    success=True,
                    output=ExecOutput(doubled=input.num * 2),
                )

        context = PipelineContext(source=PipelineSource.API)
        result = await execute_pipeline("exec_pipeline", {"num": 5}, context)

        assert result.success is True
        assert result.output.doubled == 10

    @pytest.mark.anyio
    async def test_execute_pipeline_not_found(self):
        """Test executing a nonexistent pipeline."""
        context = PipelineContext(source=PipelineSource.API)
        result = await execute_pipeline("not_found", {}, context)

        assert result.success is False
        assert "not found" in result.error.lower()

    @pytest.mark.anyio
    async def test_execute_pipeline_invalid_input(self):
        """Test executing a pipeline with invalid input."""

        class StrictInput(BaseModel):
            required_field: str

        class StrictOutput(BaseModel):
            value: str

        @register_pipeline
        class StrictPipeline(ActionPipeline[StrictInput, StrictOutput]):
            name = "strict_pipeline"
            description = "Requires valid input"

            async def execute(
                self, input: StrictInput, context: PipelineContext
            ) -> ActionResult[StrictOutput]:
                return ActionResult(
                    success=True,
                    output=StrictOutput(value=input.required_field),
                )

        context = PipelineContext(source=PipelineSource.API)
        result = await execute_pipeline("strict_pipeline", {}, context)

        assert result.success is False
        assert "validation" in result.error.lower()


class TestEchoPipeline:
    """Tests for the echo example pipeline."""

    def setup_method(self):
        """Initialize pipelines before each test."""
        # Clear registry first
        clear_registry()
        # Now initialize pipelines fresh (force_reload to re-register after clear)
        from app.pipelines.actions import discover_pipelines

        discover_pipelines(force_reload=True)

    # No teardown - let next test's setup handle clearing

    def test_echo_pipeline_registered(self):
        """Test that echo pipeline is registered."""
        pipeline = get_pipeline("echo")
        assert pipeline is not None
        assert pipeline.name == "echo"

    @pytest.mark.anyio
    async def test_echo_pipeline_basic(self):
        """Test basic echo functionality."""
        context = PipelineContext(source=PipelineSource.API)
        result = await execute_pipeline(
            "echo",
            {"message": "Hello"},
            context,
        )

        assert result.success is True
        assert result.output.echo == "Hello"
        assert result.output.length == 5
        assert result.output.source == "api"

    @pytest.mark.anyio
    async def test_echo_pipeline_uppercase(self):
        """Test echo with uppercase option."""
        context = PipelineContext(source=PipelineSource.WEBHOOK)
        result = await execute_pipeline(
            "echo",
            {"message": "hello world", "uppercase": True},
            context,
        )

        assert result.success is True
        assert result.output.echo == "HELLO WORLD"
        assert result.output.source == "webhook"

    @pytest.mark.anyio
    async def test_echo_pipeline_from_agent(self):
        """Test echo invoked from agent context."""
        from uuid import uuid4

        user_id = uuid4()
        context = PipelineContext(
            source=PipelineSource.AGENT,
            user_id=user_id,
        )
        result = await execute_pipeline(
            "echo",
            {"message": "agent test"},
            context,
        )

        assert result.success is True
        assert result.output.source == "agent"
        assert result.metadata["user_id"] == str(user_id)
