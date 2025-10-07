"""FastAPI application factory for the packaged agent service."""

from __future__ import annotations

from fastapi import FastAPI

from ag_ui_adk import add_adk_fastapi_endpoint

from ..agents import build_control_plane_agent


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""

    app = FastAPI(title="AI Employee Control Plane — Foundation Gate")
    control_plane_agent = build_control_plane_agent()
    add_adk_fastapi_endpoint(app, control_plane_agent, path="/")
    return app


# Convenience for local execution (``python -m agent.runtime.app``)
app = create_app()

