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

    The actual Runner configuration lives in ``agent/runtime`` (to be created).
    This helper exists so we can keep FastAPI initialization light while leaving
    clear TODO markers for future implementation.
    """

    # TODO: instantiate google.adk Runner with mission agents and plug it into
    # the FastAPI app via ag_ui_adk.add_adk_fastapi_endpoint. Reference
    # docs/04_implementation_guide.md (sections 3 & 4) and
    # docs/10_composio.md for Composio client wiring details.
    _ = app  # placeholder until Runner wiring lands


app = create_app()


def get_app() -> FastAPI:
    """Expose app for external entrypoints (uvicorn, tests)."""

    return app


# TODO: once Runtime/Runner factories exist, expose helper to fetch them so
# background tasks (telemetry, audit log sync) can reuse the same instances.
def get_runner() -> Optional[object]:
    """Return the configured Gemini ADK Runner.

    Currently returns ``None`` to avoid raising errors during scaffolding.
    Replace with the actual Runner object once agents are implemented.
    """

    return None
