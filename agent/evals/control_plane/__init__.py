"""Evaluation entrypoint for Gate G-A control plane agent."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[3]


def _load_module(name: str, path: Path, *, package: bool = False):
    spec = importlib.util.spec_from_file_location(
        name,
        path,
        submodule_search_locations=[str(path.parent)] if package else None,
    )
    if spec is None or spec.loader is None:  # pragma: no cover - defensive
        raise ImportError(f"Unable to load module '{name}' from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def _load_control_plane_module():
    pkg_root = ROOT / "agent"
    agents_dir = pkg_root / "agents"
    services_dir = pkg_root / "services"
    tools_dir = pkg_root / "tools"

    _load_module("agent_pkg", pkg_root / "__init__.py", package=True)
    _load_module("agent_pkg.agents", agents_dir / "__init__.py", package=True)
    _load_module("agent_pkg.services", services_dir / "__init__.py", package=True)
    _load_module("agent_pkg.tools", tools_dir / "__init__.py", package=True)

    # Ensure direct access without relative hops for coordinator imports.
    _load_module("agent_pkg.services.supabase", services_dir / "supabase.py")
    _load_module("agent_pkg.services.telemetry", services_dir / "telemetry.py")
    _load_module("agent_pkg.tools.composio_client", tools_dir / "composio_client.py")

    control_plane = _load_module(
        "agent_pkg.agents.control_plane", agents_dir / "control_plane.py"
    )
    return control_plane


_module = _load_control_plane_module()
_wrapper = _module.build_control_plane_agent()
agent = SimpleNamespace(root_agent=_wrapper._adk_agent)
