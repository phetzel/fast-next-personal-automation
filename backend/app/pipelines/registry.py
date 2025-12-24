"""Pipeline registry for discovery and invocation.

Provides a central registry for action pipelines, enabling:
- Auto-discovery via decorator
- Lookup by name
- Schema extraction for API docs and AI tools
- Automatic run tracking when db session is available
"""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext

logger = logging.getLogger(__name__)

# Global registry mapping pipeline names to classes
_PIPELINE_REGISTRY: dict[str, type[ActionPipeline]] = {}

# Cache of instantiated pipelines (singletons)
_PIPELINE_INSTANCES: dict[str, ActionPipeline] = {}


def register_pipeline(pipeline_cls: type[ActionPipeline]) -> type[ActionPipeline]:
    """Decorator to register a pipeline in the global registry.

    Example:
        @register_pipeline
        class MyPipeline(ActionPipeline[MyInput, MyOutput]):
            name = "my_pipeline"
            description = "Does something useful"
            ...

    Args:
        pipeline_cls: The ActionPipeline subclass to register.

    Returns:
        The same class (unchanged), allowing use as a decorator.

    Raises:
        ValueError: If pipeline name is missing or already registered.
    """
    if not hasattr(pipeline_cls, "name") or not pipeline_cls.name:
        raise ValueError(f"Pipeline {pipeline_cls.__name__} must define a 'name' attribute")

    if not hasattr(pipeline_cls, "description") or not pipeline_cls.description:
        raise ValueError(f"Pipeline {pipeline_cls.__name__} must define a 'description' attribute")

    name = pipeline_cls.name
    if name in _PIPELINE_REGISTRY:
        raise ValueError(f"Pipeline '{name}' is already registered")

    _PIPELINE_REGISTRY[name] = pipeline_cls
    logger.info(f"Registered pipeline: {name}")
    return pipeline_cls


def get_pipeline(name: str) -> ActionPipeline | None:
    """Get a pipeline instance by name.

    Pipelines are instantiated once and cached as singletons.

    Args:
        name: The pipeline name to look up.

    Returns:
        ActionPipeline instance if found, None otherwise.
    """
    if name not in _PIPELINE_REGISTRY:
        return None

    if name not in _PIPELINE_INSTANCES:
        _PIPELINE_INSTANCES[name] = _PIPELINE_REGISTRY[name]()

    return _PIPELINE_INSTANCES[name]


def get_pipeline_class(name: str) -> type[ActionPipeline] | None:
    """Get a pipeline class by name (without instantiating).

    Useful for schema extraction without creating an instance.

    Args:
        name: The pipeline name to look up.

    Returns:
        ActionPipeline class if found, None otherwise.
    """
    return _PIPELINE_REGISTRY.get(name)


def list_pipelines() -> list[dict[str, Any]]:
    """List all registered pipelines with their metadata.

    Returns:
        List of dicts containing pipeline info:
        - name: Pipeline identifier
        - description: Human-readable description
        - input_schema: JSON schema for input validation
        - output_schema: JSON schema for output type
        - tags: List of tags for filtering
        - area: Primary area association (or None)
    """
    pipelines = []
    for name, cls in _PIPELINE_REGISTRY.items():
        pipelines.append({
            "name": name,
            "description": cls.description,
            "input_schema": cls.get_input_schema(),
            "output_schema": cls.get_output_schema(),
            "tags": getattr(cls, "tags", []),
            "area": getattr(cls, "area", None),
        })
    return pipelines


def list_pipelines_by_tag(tag: str) -> list[dict[str, Any]]:
    """List pipelines that have a specific tag.

    Args:
        tag: The tag to filter by.

    Returns:
        List of pipeline info dicts matching the tag.
    """
    all_pipelines = list_pipelines()
    return [p for p in all_pipelines if tag in p["tags"]]


def list_pipelines_by_area(area: str) -> list[dict[str, Any]]:
    """List pipelines associated with a specific area.

    Args:
        area: The area to filter by.

    Returns:
        List of pipeline info dicts matching the area.
    """
    all_pipelines = list_pipelines()
    return [p for p in all_pipelines if p["area"] == area]


def list_pipelines_filtered(
    area: str | None = None,
    tags: list[str] | None = None,
) -> list[dict[str, Any]]:
    """List pipelines with optional filtering by area and/or tags.

    Args:
        area: Filter by primary area (exact match).
        tags: Filter by tags (must have ALL specified tags).

    Returns:
        List of pipeline info dicts matching all criteria.
    """
    pipelines = list_pipelines()

    if area is not None:
        pipelines = [p for p in pipelines if p["area"] == area]

    if tags:
        pipelines = [
            p for p in pipelines
            if all(tag in p["tags"] for tag in tags)
        ]

    return pipelines


def list_pipeline_names() -> list[str]:
    """Get just the names of all registered pipelines.

    Returns:
        List of pipeline names.
    """
    return list(_PIPELINE_REGISTRY.keys())


def get_pipeline_info(name: str) -> dict[str, Any] | None:
    """Get detailed info about a specific pipeline.

    Args:
        name: The pipeline name to look up.

    Returns:
        Dict with pipeline metadata, or None if not found.
    """
    cls = _PIPELINE_REGISTRY.get(name)
    if cls is None:
        return None

    return {
        "name": name,
        "description": cls.description,
        "input_schema": cls.get_input_schema(),
        "output_schema": cls.get_output_schema(),
        "tags": getattr(cls, "tags", []),
        "area": getattr(cls, "area", None),
    }


async def execute_pipeline(
    name: str,
    input_data: dict[str, Any],
    context: PipelineContext,
    *,
    db: AsyncSession | None = None,
) -> ActionResult:
    """Execute a pipeline by name with the given input.

    This is a convenience function that handles:
    - Pipeline lookup
    - Input validation and parsing
    - Execution with context
    - Automatic run tracking (if db session provided)

    Args:
        name: The pipeline name to execute.
        input_data: Raw input data (will be validated against input schema).
        context: Execution context.
        db: Optional database session for run tracking.

    Returns:
        ActionResult from the pipeline execution.
    """
    from app.services.pipeline_run import PipelineRunService

    pipeline = get_pipeline(name)
    if pipeline is None:
        return ActionResult(
            success=False,
            error=f"Pipeline '{name}' not found",
        )

    # Get the input type and validate
    cls = _PIPELINE_REGISTRY[name]
    input_type = cls.get_input_type()

    if input_type is None:
        return ActionResult(
            success=False,
            error=f"Pipeline '{name}' has no input type defined",
        )

    try:
        validated_input = input_type(**input_data)
    except Exception as e:
        return ActionResult(
            success=False,
            error=f"Input validation failed: {e}",
        )

    # Run custom validation if defined
    if not await pipeline.validate_input(validated_input):
        return ActionResult(
            success=False,
            error="Pipeline input validation failed",
        )

    # Create run record if db session available
    run = None
    run_service = None
    if db is not None:
        run_service = PipelineRunService(db)
        run = await run_service.create_run(
            pipeline_name=name,
            source=context.source,
            user_id=context.user_id,
            input_data=input_data,
            run_metadata=context.metadata,
        )
        run = await run_service.start_run(run)

    # Execute the pipeline
    try:
        result = await pipeline.execute(validated_input, context)

        # Record success
        if run is not None and run_service is not None:
            output_data = result.output.model_dump() if result.output else None
            if result.success:
                await run_service.complete_run(
                    run,
                    output_data=output_data,
                    run_metadata=result.metadata,
                )
            else:
                await run_service.fail_run(
                    run,
                    error_message=result.error or "Unknown error",
                    run_metadata=result.metadata,
                )

        return result
    except Exception as e:
        logger.exception(f"Pipeline '{name}' execution failed: {e}")

        # Record failure
        if run is not None and run_service is not None:
            await run_service.fail_run(run, error_message=str(e))

        return ActionResult(
            success=False,
            error=f"Pipeline execution failed: {e}",
        )


def clear_registry() -> None:
    """Clear the pipeline registry. Useful for testing."""
    _PIPELINE_REGISTRY.clear()
    _PIPELINE_INSTANCES.clear()

