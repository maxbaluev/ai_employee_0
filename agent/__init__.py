"""Agent service package for the AI Employee control plane.

This module exposes factory helpers so other modules (tests, scripts)
can import the packaged FastAPI application without relying on top-level
side effects from ``agent.py``.

Gate G-A establishes the baseline package layout used by later gates.
"""

from .runtime.app import create_app

__all__ = ["create_app"]

