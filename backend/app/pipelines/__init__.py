"""Background processing pipelines.

This module contains ETL pipelines, data processing workflows,
and batch operations that run as background tasks.

It also includes action pipelines - reusable automation units that can be
invoked from REST API, webhooks, or the AI agent.
"""

from app.pipelines.base import BasePipeline, PipelineResult

# Action pipeline base classes
from app.pipelines.action_base import (
    ActionPipeline,
    ActionResult,
    PipelineContext,
    PipelineSource,
)

# Registry functions
from app.pipelines.registry import (
    execute_pipeline,
    get_pipeline,
    get_pipeline_class,
    get_pipeline_info,
    list_pipeline_names,
    list_pipelines,
    register_pipeline,
)


def init_pipelines(force_reload: bool = False) -> None:
    """Initialize and register all action pipelines.

    Call this during application startup to ensure all pipelines
    are discovered and registered.

    Args:
        force_reload: If True, reload pipeline modules even if already imported.
                      Useful for testing after clear_registry().
    """
    # Import the actions package which triggers pipeline discovery
    from app.pipelines.actions import discover_pipelines

    discover_pipelines(force_reload=force_reload)


__all__ = [
    # Batch pipelines
    "BasePipeline",
    "PipelineResult",
    # Action pipelines
    "ActionPipeline",
    "ActionResult",
    "PipelineContext",
    "PipelineSource",
    # Registry
    "register_pipeline",
    "get_pipeline",
    "get_pipeline_class",
    "get_pipeline_info",
    "list_pipelines",
    "list_pipeline_names",
    "execute_pipeline",
    # Initialization
    "init_pipelines",
]
