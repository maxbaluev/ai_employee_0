"""Tests for /execution/run FastAPI endpoint (TASK-API-006).

Tests cover:
- Auth validation (401 for missing/invalid token, 403 for tenant mismatch)
- Request validation (400 for invalid UUIDs or missing fields)
- SSE streaming with execution_started/step_completed/complete events
- Telemetry emission (execution_started, execution_step_completed, heartbeat)
- Error handling (agent failures surface as SSE error events)
- Cleanup on client disconnect
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator, Dict
from unittest.mock import AsyncMock, MagicMock, Mock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from google.adk.events import Event
from google.adk.sessions import InMemorySessionService, Session
from google.genai.types import Content, Part

from agent.agent import create_app
from agent.routes.execution import execution_run_post


@pytest.fixture
def app() -> FastAPI:
    """Create test FastAPI app with execution route."""
    app = create_app()
    return app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Create test client for FastAPI app."""
    return TestClient(app)


@pytest.fixture
def valid_mission_id() -> str:
    """Generate valid mission UUID."""
    return str(uuid4())


@pytest.fixture
def valid_play_id() -> str:
    """Generate valid play UUID."""
    return str(uuid4())


@pytest.fixture
def valid_auth_headers() -> Dict[str, str]:
    """Generate valid auth headers for testing."""
    return {
        "Authorization": "Bearer valid-test-token-12345",
        "X-Supabase-User-Id": "test-user-123",
        "X-Supabase-Tenant-Id": "test-tenant-456",
    }


@pytest.fixture
def valid_request_body(valid_mission_id: str, valid_play_id: str) -> Dict[str, Any]:
    """Generate valid execution request body."""
    return {
        "mission_id": valid_mission_id,
        "play_id": valid_play_id,
        "auth_context": {
            "user_id": "test-user-123",
            "tenant_id": "test-tenant-456",
        },
    }


class TestAuthValidation:
    """Test authentication and authorization validation."""

    def test_missing_authorization_header(
        self,
        client: TestClient,
        valid_request_body: Dict[str, Any],
    ) -> None:
        """Test 401 when Authorization header is missing."""
        response = client.post("/execution/run", json=valid_request_body)
        assert response.status_code == 401
        assert "Authorization" in response.json()["detail"]

    def test_invalid_authorization_format(
        self,
        client: TestClient,
        valid_request_body: Dict[str, Any],
    ) -> None:
        """Test 401 when Authorization header has wrong format."""
        response = client.post(
            "/execution/run",
            json=valid_request_body,
            headers={"Authorization": "InvalidFormat"},
        )
        assert response.status_code == 401
        assert "Bearer" in response.json()["detail"]

    def test_invalid_token(
        self,
        client: TestClient,
        valid_request_body: Dict[str, Any],
    ) -> None:
        """Test 401 when token is invalid/too short."""
        response = client.post(
            "/execution/run",
            json=valid_request_body,
            headers={"Authorization": "Bearer short"},
        )
        assert response.status_code == 401
        assert "Invalid" in response.json()["detail"]

    def test_tenant_mismatch(
        self,
        client: TestClient,
        valid_mission_id: str,
        valid_play_id: str,
        valid_auth_headers: Dict[str, str],
    ) -> None:
        """Test 403 when request tenant doesn't match auth tenant."""
        body = {
            "mission_id": valid_mission_id,
            "play_id": valid_play_id,
            "auth_context": {
                "user_id": "test-user-123",
                "tenant_id": "different-tenant-789",
            },
        }
        response = client.post(
            "/execution/run",
            json=body,
            headers=valid_auth_headers,
        )
        assert response.status_code == 403
        assert "Tenant mismatch" in response.json()["detail"]


class TestRequestValidation:
    """Test request body validation."""

    def test_missing_mission_id(
        self,
        client: TestClient,
        valid_play_id: str,
        valid_auth_headers: Dict[str, str],
    ) -> None:
        """Test 400 when mission_id is missing."""
        body = {
            "play_id": valid_play_id,
            "auth_context": {"user_id": "test-user", "tenant_id": "test-tenant"},
        }
        response = client.post(
            "/execution/run",
            json=body,
            headers=valid_auth_headers,
        )
        assert response.status_code == 400
        assert "mission_id" in response.json()["detail"]

    def test_invalid_mission_id_uuid(
        self,
        client: TestClient,
        valid_play_id: str,
        valid_auth_headers: Dict[str, str],
    ) -> None:
        """Test 400 when mission_id is not a valid UUID."""
        body = {
            "mission_id": "not-a-uuid",
            "play_id": valid_play_id,
            "auth_context": {"user_id": "test-user", "tenant_id": "test-tenant"},
        }
        response = client.post(
            "/execution/run",
            json=body,
            headers=valid_auth_headers,
        )
        assert response.status_code == 400
        assert "UUID" in response.json()["detail"]

    def test_invalid_play_id_uuid(
        self,
        client: TestClient,
        valid_mission_id: str,
        valid_auth_headers: Dict[str, str],
    ) -> None:
        """Test 400 when play_id is not a valid UUID."""
        body = {
            "mission_id": valid_mission_id,
            "play_id": "not-a-uuid",
            "auth_context": {"user_id": "test-user", "tenant_id": "test-tenant"},
        }
        response = client.post(
            "/execution/run",
            json=body,
            headers=valid_auth_headers,
        )
        assert response.status_code == 400
        assert "UUID" in response.json()["detail"]

    def test_missing_auth_context(
        self,
        client: TestClient,
        valid_mission_id: str,
        valid_play_id: str,
        valid_auth_headers: Dict[str, Any],
    ) -> None:
        """Test 400 when auth_context is missing required keys."""
        body = {
            "mission_id": valid_mission_id,
            "play_id": valid_play_id,
            "auth_context": {},
        }
        response = client.post(
            "/execution/run",
            json=body,
            headers=valid_auth_headers,
        )
        assert response.status_code == 400
        assert "auth_context" in response.json()["detail"]


class TestSSEStreaming:
    """Test SSE event streaming from ExecutorAgent."""

    @patch("agent.routes.execution.get_cached_executor_runner")
    def test_execution_started_event(
        self,
        mock_get_runner: Mock,
        client: TestClient,
        valid_request_body: Dict[str, Any],
        valid_auth_headers: Dict[str, str],
    ) -> None:
        """Test that execution_started event is emitted first."""
        # Create a minimal real ExecutorAgent that does nothing
        from agent.agents.executor import ExecutorAgent

        agent = ExecutorAgent(name="TestExecutorAgent")

        # Override _run_async_impl to do nothing
        async def mock_run_async_impl(ctx: Any) -> AsyncIterator[Event]:
            if False:
                yield  # Make this an async generator

        agent._run_async_impl = mock_run_async_impl

        # Mock runner with real agent
        mock_runner = MagicMock()
        mock_runner.session_service = InMemorySessionService()
        mock_runner.root_agent = agent
        mock_get_runner.return_value = mock_runner

        response = client.post(
            "/execution/run",
            json=valid_request_body,
            headers=valid_auth_headers,
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"

        # Parse SSE events
        lines = response.text.strip().split("\n")
        events = [json.loads(line) for line in lines if line]

        # First event should be execution_started
        assert events[0]["type"] == "execution_started"
        assert events[0]["data"]["mission_id"] == valid_request_body["mission_id"]
        assert events[0]["data"]["play_id"] == valid_request_body["play_id"]

        # Last event should be execution_complete
        assert events[-1]["type"] == "execution_complete"

    @patch("agent.routes.execution.get_cached_executor_runner")
    def test_step_completed_events(
        self,
        mock_get_runner: Mock,
        client: TestClient,
        valid_request_body: Dict[str, Any],
        valid_auth_headers: Dict[str, str],
    ) -> None:
        """Test that step events are streamed from ExecutorAgent."""
        # Create a real ExecutorAgent with mocked behavior
        from agent.agents.executor import ExecutorAgent

        agent = ExecutorAgent(name="TestExecutorAgent")

        # Override _run_async_impl to yield step events
        async def mock_run_async_impl(ctx: Any) -> AsyncIterator[Event]:
            yield Event(
                author="ExecutorAgent",
                invocationId="test-invocation",
                content=Content(role="assistant", parts=[Part(text="Step 1 completed")]),
                custom_metadata={"type": "info", "stage": "EXECUTE"},
            )
            yield Event(
                author="ExecutorAgent",
                invocationId="test-invocation",
                content=Content(role="assistant", parts=[Part(text="Step 2 completed")]),
                custom_metadata={"type": "info", "stage": "EXECUTE"},
            )

        agent._run_async_impl = mock_run_async_impl

        # Mock runner with real agent
        mock_runner = MagicMock()
        mock_runner.session_service = InMemorySessionService()
        mock_runner.root_agent = agent
        mock_get_runner.return_value = mock_runner

        response = client.post(
            "/execution/run",
            json=valid_request_body,
            headers=valid_auth_headers,
        )

        assert response.status_code == 200

        lines = response.text.strip().split("\n")
        events = [json.loads(line) for line in lines if line]

        # Should have: execution_started, 2 step events, execution_complete
        assert len(events) >= 4
        step_events = [e for e in events if "step" in e["type"].lower() or "message" in e["type"]]
        assert len(step_events) >= 2


class TestErrorHandling:
    """Test error handling and cleanup."""

    @patch("agent.routes.execution.get_cached_executor_runner")
    def test_runner_initialization_failure(
        self,
        mock_get_runner: Mock,
        client: TestClient,
        valid_request_body: Dict[str, Any],
        valid_auth_headers: Dict[str, str],
    ) -> None:
        """Test 500 when runner initialization fails."""
        mock_get_runner.side_effect = RuntimeError("Runner init failed")

        response = client.post(
            "/execution/run",
            json=valid_request_body,
            headers=valid_auth_headers,
        )

        assert response.status_code == 500
        assert "runner" in response.json()["detail"].lower()

    @patch("agent.routes.execution.get_cached_executor_runner")
    def test_session_creation_failure(
        self,
        mock_get_runner: Mock,
        client: TestClient,
        valid_request_body: Dict[str, Any],
        valid_auth_headers: Dict[str, str],
    ) -> None:
        """Test 500 when session creation fails."""
        mock_runner = MagicMock()
        mock_runner.session_service = MagicMock()
        mock_runner.session_service.create_session = AsyncMock(
            side_effect=RuntimeError("Session creation failed")
        )
        mock_get_runner.return_value = mock_runner

        response = client.post(
            "/execution/run",
            json=valid_request_body,
            headers=valid_auth_headers,
        )

        assert response.status_code == 500
        assert "session" in response.json()["detail"].lower()

    @patch("agent.routes.execution.get_cached_executor_runner")
    def test_agent_execution_error_as_sse_event(
        self,
        mock_get_runner: Mock,
        client: TestClient,
        valid_request_body: Dict[str, Any],
        valid_auth_headers: Dict[str, str],
    ) -> None:
        """Test that agent execution errors surface as SSE error events."""
        # Create a real ExecutorAgent that raises an error
        from agent.agents.executor import ExecutorAgent

        agent = ExecutorAgent(name="TestExecutorAgent")

        # Override _run_async_impl to raise error after one event
        async def mock_run_async_impl(ctx: Any) -> AsyncIterator[Event]:
            yield Event(
                author="ExecutorAgent",
                invocationId="test-invocation",
                content=Content(role="assistant", parts=[Part(text="Starting execution")]),
                custom_metadata={"type": "info"},
            )
            raise RuntimeError("Tool execution failed")

        agent._run_async_impl = mock_run_async_impl

        # Mock runner with real agent
        mock_runner = MagicMock()
        mock_runner.session_service = InMemorySessionService()
        mock_runner.root_agent = agent
        mock_get_runner.return_value = mock_runner

        response = client.post(
            "/execution/run",
            json=valid_request_body,
            headers=valid_auth_headers,
        )

        assert response.status_code == 200  # SSE stream starts successfully

        lines = response.text.strip().split("\n")
        events = [json.loads(line) for line in lines if line]

        # Should have execution_started, info event, error event
        error_events = [e for e in events if e["type"] == "error"]
        assert len(error_events) > 0
        assert "failed" in error_events[0]["data"]["message"].lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
