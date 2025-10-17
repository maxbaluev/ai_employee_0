"""Tests for the Supabase-backed session service."""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any
from uuid import uuid4

import pytest
from google.adk.events import Event, EventActions
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

from agent.services.session import SupabaseSessionService, create_session_service


# ---------------------------------------------------------------------------
# Fake Supabase client ------------------------------------------------------
# ---------------------------------------------------------------------------


class FakeResult:
    def __init__(self, data: Any) -> None:
        self.data = data
        self.error = None


class FakeSupabaseClient:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}
        self.force_conflict: bool = False
        self.raise_on_update: Exception | None = None
        self.select_count: int = 0
        self.update_count: int = 0

    def table(self, name: str) -> "FakeTable":
        assert name == "mission_sessions"
        return FakeTable(self)


class FakeTable:
    def __init__(self, client: FakeSupabaseClient) -> None:
        self._client = client
        self._action: str | None = None
        self._payload: dict[str, Any] | None = None
        self._filters: list[tuple[str, Any]] = []
        self._single = False

    # Builders -----------------------------------------------------------------
    def select(self, _columns: str = "*") -> "FakeTable":
        self._action = "select"
        return self

    def upsert(self, payload: dict[str, Any], *, on_conflict: str) -> "FakeTable":
        assert on_conflict == "session_key"
        self._action = "upsert"
        self._payload = dict(payload)
        return self

    def update(self, payload: dict[str, Any]) -> "FakeTable":
        self._action = "update"
        self._payload = dict(payload)
        return self

    def delete(self) -> "FakeTable":
        self._action = "delete"
        return self

    # Query modifiers ----------------------------------------------------------
    def eq(self, column: str, value: Any) -> "FakeTable":
        self._filters.append((column, value))
        return self

    def single(self) -> "FakeTable":
        self._single = True
        return self

    # Execution ----------------------------------------------------------------
    async def execute(self) -> FakeResult:
        action = self._action
        if action == "select":
            self._client.select_count += 1
            rows = [row for row in self._client.rows.values() if self._matches(row)]
            if self._single:
                return FakeResult(rows[0] if rows else None)
            return FakeResult(rows)

        if action == "upsert":
            payload = dict(self._payload or {})
            session_key = payload["session_key"]
            existing = self._client.rows.get(session_key)
            if existing:
                existing.update(payload)
            else:
                self._client.rows[session_key] = payload
            return FakeResult(payload)

        if action == "update":
            if self._client.raise_on_update is not None:
                exc = self._client.raise_on_update
                self._client.raise_on_update = self._client.raise_on_update  # maintain state for retries
                raise exc

            updated = []
            for session_key, row in list(self._client.rows.items()):
                if not self._matches(row):
                    continue
                if self._client.force_conflict:
                    self._client.force_conflict = False
                    return FakeResult([])
                row.update(self._payload or {})
                self._client.rows[session_key] = row
                updated.append(dict(row))
            self._client.update_count += len(updated)
            return FakeResult(updated)

        if action == "delete":
            keys_to_remove = [key for key, row in self._client.rows.items() if self._matches(row)]
            for key in keys_to_remove:
                self._client.rows.pop(key, None)
            return FakeResult([])

        raise AssertionError(f"Unsupported action {action}")

    # Helpers ------------------------------------------------------------------
    def _matches(self, row: dict[str, Any]) -> bool:
        for column, value in self._filters:
            if row.get(column) != value:
                return False
        return True


# ---------------------------------------------------------------------------
# Fixtures ------------------------------------------------------------------
# ---------------------------------------------------------------------------


@pytest.fixture()
def fake_client() -> FakeSupabaseClient:
    return FakeSupabaseClient()


def make_event(delta: dict[str, Any]) -> Event:
    return Event(
        author="executor",
        invocation_id="invoke-1",
        content=Content(role="assistant", parts=[Part(text="ok")]),
        actions=EventActions(state_delta=delta),
    )


async def _wait_for(predicate, timeout: float = 0.25) -> bool:
    deadline = time.perf_counter() + timeout
    while time.perf_counter() < deadline:
        if predicate():
            return True
        await asyncio.sleep(0.01)
    return predicate()


async def _create_service(
    fake_client: FakeSupabaseClient,
    *,
    heartbeat_seconds: float = 30.0,
    backoff_seconds: float = 0.05,
    max_retry_backoff: float = 0.2,
) -> SupabaseSessionService:
    return SupabaseSessionService(
        fake_client,
        heartbeat_seconds=heartbeat_seconds,
        backoff_seconds=backoff_seconds,
        max_retry_backoff=max_retry_backoff,
    )


# ---------------------------------------------------------------------------
# Tests ---------------------------------------------------------------------
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_read_through_cache_hits_supabase_once(fake_client: FakeSupabaseClient) -> None:
    service = await _create_service(fake_client)
    mission_id = uuid4()
    await service.create_session(
        app_name="control-plane",
        user_id="user-1",
        state={"mission_id": str(mission_id), "agent_name": "coordinator"},
        session_id="sess-cache",
    )

    service._cache.clear()  # simulate cold start
    fake_client.select_count = 0

    session_a = await service.get_session(app_name="control-plane", user_id="user-1", session_id="sess-cache")
    session_b = await service.get_session(app_name="control-plane", user_id="user-1", session_id="sess-cache")

    assert session_a is not None
    assert session_b is session_a
    assert fake_client.select_count == 1
    await service.shutdown()


@pytest.mark.asyncio
async def test_append_event_defers_write_until_checkpoint(fake_client: FakeSupabaseClient) -> None:
    service = await _create_service(fake_client, heartbeat_seconds=5.0)
    mission_id = uuid4()
    session = await service.create_session(
        app_name="control-plane",
        user_id="user-2",
        state={"mission_id": str(mission_id), "agent_name": "executor"},
        session_id="sess-deferral",
    )

    await service.append_event(session, make_event({"current_stage": "EXECUTE"}))
    assert fake_client.rows["sess-deferral"]["version"] == 1  # write-behind, no immediate flush

    await service.checkpoint(session.id, "executor")
    row = fake_client.rows["sess-deferral"]
    assert row["version"] == 2
    assert row["state_snapshot"]["current_stage"] == "EXECUTE"
    await service.shutdown()


@pytest.mark.asyncio
async def test_heartbeat_flush_persists_after_interval(fake_client: FakeSupabaseClient) -> None:
    service = await _create_service(fake_client, heartbeat_seconds=0.05, backoff_seconds=0.01)
    mission_id = uuid4()
    session = await service.create_session(
        app_name="control-plane",
        user_id="user-3",
        state={"mission_id": str(mission_id), "agent_name": "planner"},
        session_id="sess-heartbeat",
    )

    await service.append_event(session, make_event({"checkpoint": "pending"}))
    await _wait_for(lambda: fake_client.rows["sess-heartbeat"]["version"] == 2)

    row = fake_client.rows["sess-heartbeat"]
    assert row["state_snapshot"]["checkpoint"] == "pending"
    await service.shutdown()


@pytest.mark.asyncio
async def test_conflict_retry_merges_remote_state(fake_client: FakeSupabaseClient) -> None:
    service = await _create_service(fake_client, backoff_seconds=0.01)
    mission_id = uuid4()
    session = await service.create_session(
        app_name="control-plane",
        user_id="user-4",
        state={"mission_id": str(mission_id), "agent_name": "validator", "shared": "remote"},
        session_id="sess-conflict",
    )

    fake_client.rows["sess-conflict"]["state_snapshot"]["remote"] = "keep"
    fake_client.rows["sess-conflict"]["version"] = 2
    fake_client.force_conflict = True

    await service.append_event(session, make_event({"shared": "local"}))
    await service.checkpoint(session.id, "validator")

    row = fake_client.rows["sess-conflict"]
    assert row["version"] == 3
    assert row["state_snapshot"]["remote"] == "keep"
    assert row["state_snapshot"]["shared"] == "local"
    await service.shutdown()


@pytest.mark.asyncio
async def test_outage_queue_and_retry(fake_client: FakeSupabaseClient) -> None:
    service = await _create_service(fake_client, backoff_seconds=0.01, max_retry_backoff=0.05)
    mission_id = uuid4()
    session = await service.create_session(
        app_name="control-plane",
        user_id="user-5",
        state={"mission_id": str(mission_id), "agent_name": "executor"},
        session_id="sess-outage",
    )

    await service.append_event(session, make_event({"status": "queued"}))
    fake_client.raise_on_update = RuntimeError("supabase down")

    with pytest.raises(RuntimeError):
        await service.checkpoint(session.id, "executor")

    assert fake_client.rows["sess-outage"]["version"] == 1

    fake_client.raise_on_update = None
    await _wait_for(lambda: fake_client.rows["sess-outage"]["version"] == 2)

    row = fake_client.rows["sess-outage"]
    assert row["state_snapshot"]["status"] == "queued"
    await service.shutdown()


@pytest.mark.asyncio
async def test_save_state_flushes_immediately(fake_client: FakeSupabaseClient) -> None:
    service = await _create_service(fake_client)
    mission_id = uuid4()
    await service.create_session(
        app_name="control-plane",
        user_id="user-6",
        state={"mission_id": str(mission_id), "agent_name": "executor"},
        session_id="sess-save",
    )

    await service.save_state("sess-save", {"manual": True}, "executor")
    row = fake_client.rows["sess-save"]
    assert row["version"] == 2
    assert row["state_snapshot"]["manual"] is True
    await service.shutdown()


@pytest.mark.asyncio
async def test_delete_session_clears_cache(fake_client: FakeSupabaseClient) -> None:
    service = await _create_service(fake_client)
    mission_id = uuid4()
    await service.create_session(
        app_name="control-plane",
        user_id="user-7",
        state={"mission_id": str(mission_id), "agent_name": "executor"},
        session_id="sess-delete",
    )

    assert "sess-delete" in service._cache
    await service.delete_session(app_name="control-plane", user_id="user-7", session_id="sess-delete")
    assert "sess-delete" not in service._cache
    assert "sess-delete" not in fake_client.rows


@pytest.mark.asyncio
async def test_shutdown_flushes_pending_writes(fake_client: FakeSupabaseClient) -> None:
    service = await _create_service(fake_client, heartbeat_seconds=5.0)
    mission_id = uuid4()
    session = await service.create_session(
        app_name="control-plane",
        user_id="user-8",
        state={"mission_id": str(mission_id), "agent_name": "executor"},
        session_id="sess-shutdown",
    )

    await service.append_event(session, make_event({"cleanup": "pending"}))
    await service.shutdown()

    row = fake_client.rows["sess-shutdown"]
    assert row["version"] == 2
    assert row["state_snapshot"]["cleanup"] == "pending"


@pytest.mark.asyncio
async def test_load_state_returns_cached_copy(fake_client: FakeSupabaseClient) -> None:
    service = await _create_service(fake_client)
    mission_id = uuid4()
    await service.create_session(
        app_name="control-plane",
        user_id="user-9",
        state={"mission_id": str(mission_id), "agent_name": "executor", "flag": "yes"},
        session_id="sess-load",
    )

    state = await service.load_state("sess-load")
    assert state["flag"] == "yes"
    await service.shutdown()


@pytest.mark.asyncio
async def test_eval_mode_factory_returns_inmemory(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EVAL_MODE", "true")
    service = create_session_service()
    assert isinstance(service, InMemorySessionService)

    monkeypatch.delenv("EVAL_MODE", raising=False)
    with pytest.raises(ValueError):
        create_session_service()


@pytest.mark.asyncio
async def test_factory_requires_client_when_not_eval(monkeypatch: pytest.MonkeyPatch, fake_client: FakeSupabaseClient) -> None:
    monkeypatch.delenv("EVAL_MODE", raising=False)
    with pytest.raises(ValueError):
        create_session_service()

    service = create_session_service(supabase_client=fake_client)
    assert isinstance(service, SupabaseSessionService)
