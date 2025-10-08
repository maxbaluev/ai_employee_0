"""FastAPI entrypoint exposing the Gate G-A control plane agent."""

from __future__ import annotations

from fastapi import FastAPI
from ag_ui_adk import add_adk_fastapi_endpoint
from dotenv import load_dotenv

from agent.agents.control_plane import build_control_plane_agent

load_dotenv()


control_plane_adk = build_control_plane_agent()

app = FastAPI(title="AI Employee Control Plane — Gate G-A")

add_adk_fastapi_endpoint(app, control_plane_adk, path="/")


@app.get("/health", tags=["health"])
async def healthcheck() -> dict[str, str]:
    """Simple health endpoint for readiness probes."""

    return {"status": "ok"}
