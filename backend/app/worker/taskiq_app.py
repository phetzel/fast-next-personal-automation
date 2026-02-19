"""Taskiq application configuration."""

from taskiq import TaskiqScheduler
from taskiq.schedule_sources import LabelScheduleSource
from taskiq_redis import ListQueueBroker, RedisAsyncResultBackend

from app.core.config import settings
from app.pipelines.actions import discover_pipelines
from app.worker.schedule_source import DatabaseScheduleSource

# Create Taskiq broker with Redis
broker = ListQueueBroker(
    url=settings.TASKIQ_BROKER_URL,
).with_result_backend(
    RedisAsyncResultBackend(
        redis_url=settings.TASKIQ_RESULT_BACKEND,
    )
)

# Import scheduled tasks so decorators register with broker
import app.worker.tasks.scheduled_pipeline  # noqa: E402
import app.worker.tasks.schedules  # noqa: F401, E402

# Register action pipelines in worker process so scheduled execution can resolve by name.
# force_reload=True handles cases where modules are already imported in-process.
discover_pipelines(force_reload=True)

# Create scheduler for periodic tasks with both label-based and database sources
# Label-based: Traditional decorator-based schedules (for built-in tasks)
# Database: Dynamic schedules managed via the API/calendar UI
scheduler = TaskiqScheduler(
    broker=broker,
    sources=[
        LabelScheduleSource(broker),
        DatabaseScheduleSource(),
    ],
)


# Startup/shutdown hooks
@broker.on_event("startup")
async def startup() -> None:
    """Initialize broker on startup."""
    pass


@broker.on_event("shutdown")
async def shutdown() -> None:
    """Cleanup on shutdown."""
    pass
