"""Action pipelines module.

This module contains concrete action pipeline implementations.
Pipelines are automatically registered when imported.

To add a new pipeline:
1. Create a new file in this directory (e.g., my_pipeline.py)
2. Define input/output Pydantic models
3. Create a class extending ActionPipeline with @register_pipeline decorator
4. Add an import in discover_pipelines() below
"""

import importlib
import sys


def discover_pipelines(force_reload: bool = False) -> None:
    """Import all pipeline modules to trigger registration.

    This function is called during app initialization to ensure
    all pipelines are registered before use.

    Args:
        force_reload: If True, reload modules even if already imported.
                      Useful for testing after clear_registry().
    """
    # List of pipeline modules to discover
    # Note: job_analyze is NOT registered here - it's used internally by job_prep
    # and job_apply. The job_prep pipeline auto-analyzes when needed (auto_analyze=True).
    pipeline_modules = [
        "app.pipelines.actions.echo",
        "app.pipelines.actions.job_search.pipeline",
        "app.pipelines.actions.job_search.batch_pipeline",
        "app.pipelines.actions.job_prep.pipeline",
        "app.pipelines.actions.job_prep.batch_pipeline",
        "app.pipelines.actions.job_apply.pipeline",
    ]

    for module_name in pipeline_modules:
        if force_reload and module_name in sys.modules:
            # Reload to re-trigger @register_pipeline decorator
            importlib.reload(sys.modules[module_name])
        else:
            # Standard import
            importlib.import_module(module_name)
