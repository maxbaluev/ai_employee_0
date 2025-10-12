"""Agent service package for the AI Employee control plane.

This module exposes factory helpers so other modules (tests, scripts)
can import the packaged FastAPI application without relying on top-level
side effects from ``agent.py``.

Gate G-A establishes the baseline package layout used by later gates.
"""

from types import SimpleNamespace

from .agents import build_control_plane_agent
from .runtime.app import create_app

_ROOT_AGENT = build_control_plane_agent()._adk_agent
root_agent = _ROOT_AGENT
agent = SimpleNamespace(root_agent=root_agent)

__all__ = ["create_app", "root_agent", "agent"]
