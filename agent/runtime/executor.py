"""ADK Runner factory for ExecutorAgent with session/telemetry integration.

This module provides the runtime factory that wires ExecutorAgent with
SupabaseSessionService, TelemetryClient, and ComposioClientWrapper for
governed mission execution per docs/04_implementation_guide.md §3-4 and
docs/backlog.md TASK-API-006.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, Optional

from google.adk.agents import BaseAgent
from google.adk.runners import InMemoryRunner
from google.adk.sessions import BaseSessionService

from agent.agents.executor import ExecutorAgent
from agent.agents.validator import ValidatorAgent
from agent.agents.evidence import EvidenceAgent
from agent.services.composio import ComposioClientWrapper
from agent.services.session import create_session_service
from agent.services.telemetry import TelemetryClient


def _env_truthy(key: str, default: str = "") -> bool:
    """Helper to parse truthy environment variables."""
    return os.getenv(key, default).strip().lower() in {"1", "true", "yes", "on"}


def create_executor_runner(
    *,
    session_service: Optional[BaseSessionService] = None,
    composio_client: Optional[ComposioClientWrapper] = None,
    telemetry_client: Optional[TelemetryClient] = None,
    validator_agent: Optional[ValidatorAgent] = None,
    evidence_agent: Optional[EvidenceAgent] = None,
    eval_mode: Optional[bool] = None,
    heartbeat_seconds: float = 30.0,
    max_retries: int = 3,
) -> InMemoryRunner:
    """Create ADK Runner configured for ExecutorAgent.

    Args:
        session_service: Session persistence service (InMemory or Supabase).
        composio_client: Composio SDK wrapper for tool execution.
        telemetry_client: Telemetry emission client.
        validator_agent: Validator sub-agent for safeguard checks.
        evidence_agent: Evidence sub-agent for artifact packaging.
        eval_mode: Force InMemorySessionService if True (defaults to EVAL_MODE env).
        heartbeat_seconds: Heartbeat interval for session liveness.
        max_retries: Max retry attempts for rate-limited calls.

    Returns:
        Configured ADK InMemoryRunner ready for execution.
    """
    if eval_mode is None:
        eval_mode = _env_truthy("EVAL_MODE")

    # Create session service if not provided
    if session_service is None:
        supabase_client = None
        if not eval_mode:
            # In production, attempt to get Supabase client
            # (deferred: actual Supabase client initialization)
            # For now, fall back to InMemory if not explicitly provided
            pass
        session_service = create_session_service(
            supabase_client=supabase_client,
            eval_mode=eval_mode,
            heartbeat_seconds=heartbeat_seconds,
        )

    # Create telemetry client if not provided
    if telemetry_client is None:
        telemetry_client = TelemetryClient(destination="supabase")

    # Create Composio client wrapper if not provided
    if composio_client is None:
        # In production, initialize real Composio client
        # For now, use placeholder
        composio_client = ComposioClientWrapper(client=None)

    # Create validator if not provided
    if validator_agent is None:
        validator_agent = ValidatorAgent(
            name="ValidatorAgent",
            composio_client=composio_client,
            telemetry=telemetry_client,
        )

    # Create evidence agent if not provided
    if evidence_agent is None:
        evidence_agent = EvidenceAgent(
            name="EvidenceAgent",
            composio_client=composio_client,
            telemetry=telemetry_client,
        )

    # Create ExecutorAgent
    executor = ExecutorAgent(
        name="ExecutorAgent",
        validator_agent=validator_agent,
        evidence_agent=evidence_agent,
        composio_client=composio_client,
        telemetry=telemetry_client,
        heartbeat_seconds=heartbeat_seconds,
        max_retries=max_retries,
    )

    # Create and return ADK Runner
    runner = InMemoryRunner(
        root_agent=executor,
        session_service=session_service,
        app_name="ai-employee-control-plane",
    )

    return runner


@lru_cache(maxsize=1)
def get_cached_executor_runner() -> InMemoryRunner:
    """Cached singleton runner for production use.

    Returns the same runner instance across multiple API calls to avoid
    redundant initialization overhead.
    """
    return create_executor_runner()


__all__ = ["create_executor_runner", "get_cached_executor_runner"]
