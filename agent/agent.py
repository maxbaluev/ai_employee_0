"""FastAPI scaffolding for the Gemini ADK control plane backend.

This file purposefully omits the demo Proverbs agent. Instead, it sets up a
lean FastAPI application with TODO hooks for wiring the Coordinator, Inspector,
Planner, Executor, Validator, and Evidence agents described throughout the
project documentation.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI

# Load environment variables upfront so downstream services (Composio, Supabase)
# can access secrets without manual shell exports.
load_dotenv()


def create_app() -> FastAPI:
    """Create the FastAPI application used by uvicorn and tests."""

    app = FastAPI(
        title="AI Employee Control Plane",
        version="0.0.0",
        description=(
            "Mission lifecycle backend scaffolding for the AI Employee Control "
            "Plane. TODO: wire Gemini ADK agents and Composio SDK once the "
            "Planner/Executor flows are implemented."
        ),
    )

    @app.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        """Simple health endpoint consumed by readiness checks."""

        return {"status": "ok"}

    register_adk_routes(app)

    return app


@lru_cache(maxsize=1)
def register_adk_routes(app: FastAPI) -> None:
    """Attach Gemini ADK endpoints once agents are available.

    The actual Runner configuration lives in ``agent/runtime/executor.py``.
    This helper wires ExecutorAgent's /execution/run endpoint into FastAPI
    per docs/04_implementation_guide.md §3-4 and docs/backlog.md TASK-API-006.
    """

    from agent.routes.execution import execution_run_post

    app.post("/execution/run", tags=["execution"])(execution_run_post)


app = create_app()


def get_app() -> FastAPI:
    """Expose app for external entrypoints (uvicorn, tests)."""

    return app


def get_runner() -> Optional[object]:
    """Return the configured Gemini ADK Runner.

    Exposes the ExecutorAgent runner for background tasks (telemetry, audit
    log sync) to reuse the same instance.
    """

    from agent.runtime.executor import get_cached_executor_runner

    return get_cached_executor_runner()
