"""Session service implementations for the Gemini ADK backend."""

from __future__ import annotations

import asyncio
import json
import os
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Deque, Optional
from uuid import UUID, uuid4

from google.adk.events import Event
from google.adk.sessions import BaseSessionService, InMemorySessionService, Session
from google.adk.sessions.base_session_service import (
    GetSessionConfig,
    ListSessionsResponse,
)

__all__ = ["SupabaseSessionService", "create_session_service"]


# ---------------------------------------------------------------------------
# Helper utilities -----------------------------------------------------------
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_size_bytes(payload: dict[str, Any]) -> int:
    try:
        return len(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    except TypeError:
        serialised = json.dumps(payload, default=str, separators=(",", ":"))
        return len(serialised.encode("utf-8"))


def _coerce_uuid(value: Any) -> str:
    try:
        return str(UUID(str(value)))
    except (TypeError, ValueError) as exc:  # pragma: no cover - validation guard
        raise ValueError("mission_id must be a valid UUID string") from exc


async def _maybe_await(result: Any) -> Any:
    if asyncio.iscoroutine(result):
        return await result
    if isinstance(result, asyncio.Task):
        return await result
    return result


def _env_truthy(raw: str) -> bool:
    return raw.strip().lower() in {"1", "true", "yes", "on"}


# ---------------------------------------------------------------------------
# Internal data models -------------------------------------------------------
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class _WriteRequest:
    """Represents a batched snapshot queued for persistence."""

    snapshot: dict[str, Any]
    reason: str
    enqueued_at: float


@dataclass(slots=True)
class _SessionCacheEntry:
    """Tracks in-memory state for a Supabase-backed session."""

    session: Session
    version: int
    app_name: str
    user_id: str
    agent_name: str
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    write_queue: Deque[_WriteRequest] = field(default_factory=deque)
    pending_delta: dict[str, Any] = field(default_factory=dict)
    dirty: bool = False
    last_loaded_at: float = field(default_factory=time.time)
    last_mutation_at: float = field(default_factory=time.time)
    last_flush_at: float = field(default_factory=time.time)
    heartbeat_task: asyncio.Task | None = None
    retry_task: asyncio.Task | None = None
    retry_attempts: int = 0
    outage_error: str | None = None

    def mark_dirty(self, delta: dict[str, Any]) -> None:
        if delta:
            self.pending_delta.update(delta)
        self.dirty = True
        self.last_mutation_at = time.time()

    def enqueue_snapshot(self, snapshot: dict[str, Any], reason: str, *, max_size: int) -> None:
        self.write_queue.append(_WriteRequest(snapshot=snapshot, reason=reason, enqueued_at=time.time()))
        while len(self.write_queue) > max_size:
            self.write_queue.popleft()

    def cancel_tasks(self) -> None:
        if self.heartbeat_task and not self.heartbeat_task.done():
            self.heartbeat_task.cancel()
        if self.retry_task and not self.retry_task.done():
            self.retry_task.cancel()


# ---------------------------------------------------------------------------
# Supabase-backed session service -------------------------------------------
# ---------------------------------------------------------------------------


class SupabaseSessionService(BaseSessionService):
    """Supabase-backed implementation of the ADK session service.

    The service keeps a per-session in-memory cache (read-through) and defers
    persistence to Supabase using a configurable write-behind strategy. Writes
    are batched and flushed on checkpoints, explicit heartbeats, or the
    heartbeat interval. Conflicts trigger optimistic-lock retries and failed
    writes are queued for later retry when Supabase becomes available again.
    """

    def __init__(
        self,
        supabase_client: Any,
        *,
        table_name: str = "mission_sessions",
        max_retries: int = 3,
        backoff_seconds: float = 0.2,
        heartbeat_seconds: float = 30.0,
        max_retry_backoff: float = 5.0,
        queue_max_size: int = 32,
    ) -> None:
        if supabase_client is None:
            raise ValueError("Supabase client is required for SupabaseSessionService")
        self._client = supabase_client
        self._table_name = table_name
        self._max_retries = max(1, max_retries)
        self._backoff_seconds = max(0.01, backoff_seconds)
        self._heartbeat_seconds = max(0.05, heartbeat_seconds)
        self._max_retry_backoff = max(0.05, max_retry_backoff)
        self._queue_max_size = max(1, queue_max_size)
        self._cache: dict[str, _SessionCacheEntry] = {}

    # ------------------------------------------------------------------
    # BaseSessionService implementation --------------------------------
    # ------------------------------------------------------------------

    async def create_session(
        self,
        *,
        app_name: str,
        user_id: str,
        state: Optional[dict[str, Any]] = None,
        session_id: Optional[str] = None,
    ) -> Session:
        session_state: dict[str, Any] = dict(state or {})
        session_key = session_id.strip() if session_id and session_id.strip() else str(uuid4())

        mission_id = session_state.get("mission_id")
        if mission_id is None:
            raise ValueError("SupabaseSessionService requires 'mission_id' in the session state")
        mission_uuid = _coerce_uuid(mission_id)
        session_state.setdefault("mission_id", mission_uuid)

        agent_name = (
            session_state.get("agent_name")
            or session_state.get("current_agent")
            or session_state.get("planner_agent")
            or app_name
        )
        session_state.setdefault("agent_name", agent_name)

        now_iso = _now_iso()
        row = {
            "session_key": session_key,
            "mission_id": mission_uuid,
            "agent_name": str(agent_name),
            "app_name": app_name,
            "user_id": user_id,
            "state_snapshot": session_state,
            "state_size_bytes": _json_size_bytes(session_state),
            "version": 1,
            "status": "active",
            "last_heartbeat_at": now_iso,
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        builder = self._table().upsert(row, on_conflict="session_key")
        result = await _maybe_await(builder.execute())
        if hasattr(result, "error") and result.error:
            raise RuntimeError(f"Failed to upsert session: {result.error}")

        session = Session(
            id=session_key,
            app_name=app_name,
            user_id=user_id,
            state=dict(session_state),
            events=[],
            last_update_time=time.time(),
        )

        entry = _SessionCacheEntry(
            session=session,
            version=1,
            app_name=app_name,
            user_id=user_id,
            agent_name=str(agent_name),
        )
        self._cache[session_key] = entry
        return session

    async def get_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        config: Optional[GetSessionConfig] = None,
    ) -> Optional[Session]:
        entry = await self._get_or_load_entry(session_id=session_id, app_name=app_name, user_id=user_id)
        if entry is None:
            return None

        session = entry.session
        if config and config.num_recent_events:
            session.events = session.events[-config.num_recent_events :]
        return session

    async def list_sessions(self, *, app_name: str, user_id: str) -> ListSessionsResponse:
        builder = self._table().select("session_key, state_snapshot, app_name, user_id")
        builder = builder.eq("app_name", app_name)
        builder = builder.eq("user_id", user_id)
        result = await _maybe_await(builder.execute())
        data = getattr(result, "data", result) or []

        sessions: list[Session] = []
        for row in data:
            session = Session(
                id=row.get("session_key"),
                app_name=row.get("app_name", app_name),
                user_id=row.get("user_id", user_id),
                state=row.get("state_snapshot", {}),
                events=[],
                last_update_time=time.time(),
            )
            sessions.append(session)
        return ListSessionsResponse(sessions=sessions)

    async def delete_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
    ) -> None:
        entry = self._cache.pop(session_id, None)
        if entry is not None:
            entry.cancel_tasks()
        builder = self._table().delete().eq("session_key", session_id)
        await _maybe_await(builder.execute())

    async def append_event(self, session: Session, event: Event) -> Event:
        updated_event = await super().append_event(session=session, event=event)
        entry = await self._ensure_entry_for_session(session)
        delta = event.actions.state_delta if event.actions and event.actions.state_delta else {}
        entry.mark_dirty(delta)
        if delta.get("agent_name"):
            entry.agent_name = str(delta["agent_name"])
        entry.enqueue_snapshot(dict(session.state), "event", max_size=self._queue_max_size)
        self._schedule_heartbeat(session.id)
        return updated_event

    # ------------------------------------------------------------------
    # Public helpers ----------------------------------------------------
    # ------------------------------------------------------------------

    async def load_state(self, session_id: str) -> dict[str, Any]:
        entry = await self._get_or_load_entry(session_id=session_id)
        if entry is None:
            return {}
        return dict(entry.session.state)

    async def save_state(self, session_id: str, state: dict[str, Any], agent_name: str) -> None:
        entry = await self._get_or_load_entry(session_id=session_id)
        if entry is None:
            raise RuntimeError(f"Session {session_id} not found")
        entry.session.state.update(state)
        entry.session.last_update_time = time.time()
        entry.agent_name = agent_name
        entry.mark_dirty(state)
        entry.enqueue_snapshot(dict(entry.session.state), "save_state", max_size=self._queue_max_size)
        await self._flush_with_retry(session_id, reason="save_state", force=True)

    async def checkpoint(self, session_id: str, agent_name: str, *, reason: str = "checkpoint") -> None:
        entry = await self._get_or_load_entry(session_id=session_id)
        if entry is None:
            raise RuntimeError(f"Session {session_id} not found")
        entry.agent_name = agent_name
        await self._flush_with_retry(session_id, reason=reason, force=True)

    async def heartbeat(self, session_id: str, agent_name: str) -> None:
        entry = await self._get_or_load_entry(session_id=session_id)
        if entry is None:
            raise RuntimeError(f"Session {session_id} not found")
        entry.agent_name = agent_name
        await self._flush_with_retry(session_id, reason="heartbeat")

    async def flush(self, session_id: str, *, reason: str = "manual", force: bool = False) -> None:
        await self._flush_with_retry(session_id, reason=reason, force=force)

    async def cleanup(self, session_id: str) -> None:
        try:
            await self._flush_with_retry(session_id, reason="cleanup", force=True)
        finally:
            entry = self._cache.pop(session_id, None)
            if entry is not None:
                entry.cancel_tasks()

    async def shutdown(self) -> None:
        """Flush all sessions and cancel background tasks (tests/teardown)."""

        flushes = [self._flush_with_retry(session_id, reason="shutdown", force=True) for session_id in list(self._cache)]
        if flushes:
            await asyncio.gather(*flushes, return_exceptions=True)
        for entry in self._cache.values():
            entry.cancel_tasks()
        self._cache.clear()

    # ------------------------------------------------------------------
    # Internal helpers --------------------------------------------------
    # ------------------------------------------------------------------

    async def _flush_with_retry(self, session_id: str, *, reason: str, force: bool = False) -> None:
        try:
            await self._flush_session(session_id, reason=reason, force=force)
        except Exception:
            self._schedule_retry(session_id)
            raise

    async def _ensure_entry_for_session(self, session: Session) -> _SessionCacheEntry:
        entry = self._cache.get(session.id)
        if entry is None:
            entry = await self._hydrate_entry_from_supabase(session_id=session.id, app_name=session.app_name, user_id=session.user_id)
            if entry is None:
                raise RuntimeError(f"Session {session.id} not found when hydrating cache")
            self._cache[session.id] = entry
        entry.session = session
        return entry

    async def _get_or_load_entry(
        self,
        *,
        session_id: str,
        app_name: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Optional[_SessionCacheEntry]:
        entry = self._cache.get(session_id)
        if entry is not None:
            return entry
        entry = await self._hydrate_entry_from_supabase(session_id=session_id, app_name=app_name, user_id=user_id)
        if entry is not None:
            self._cache[session_id] = entry
        return entry

    async def _hydrate_entry_from_supabase(
        self,
        *,
        session_id: str,
        app_name: Optional[str],
        user_id: Optional[str],
    ) -> Optional[_SessionCacheEntry]:
        row = await self._fetch_row(session_id)
        if not row:
            return None

        session = Session(
            id=session_id,
            app_name=row.get("app_name") or app_name or "control-plane",
            user_id=row.get("user_id") or user_id or "unknown",
            state=dict(row.get("state_snapshot") or {}),
            events=[],
            last_update_time=time.time(),
        )
        entry = _SessionCacheEntry(
            session=session,
            version=row.get("version", 1),
            app_name=session.app_name,
            user_id=session.user_id,
            agent_name=str(row.get("agent_name") or session.app_name),
        )
        entry.last_loaded_at = time.time()
        entry.last_flush_at = time.time()
        return entry

    def _schedule_heartbeat(self, session_id: str) -> None:
        entry = self._cache.get(session_id)
        if entry is None:
            return
        if entry.heartbeat_task and not entry.heartbeat_task.done():
            entry.heartbeat_task.cancel()
        loop = self._loop()
        entry.heartbeat_task = loop.create_task(self._flush_after_delay(session_id, self._heartbeat_seconds, reason="heartbeat"))

    def _schedule_retry(self, session_id: str) -> None:
        entry = self._cache.get(session_id)
        if entry is None:
            return
        if entry.retry_task and not entry.retry_task.done():
            return
        delay = min(self._backoff_seconds * (2 ** max(entry.retry_attempts, 0)), self._max_retry_backoff)
        entry.retry_attempts += 1
        loop = self._loop()
        entry.retry_task = loop.create_task(self._retry_flush(session_id, delay))

    async def _flush_after_delay(self, session_id: str, delay: float, *, reason: str) -> None:
        try:
            await asyncio.sleep(delay)
            await self._flush_session(session_id, reason=reason)
        except asyncio.CancelledError:
            raise
        except Exception:
            self._schedule_retry(session_id)

    async def _retry_flush(self, session_id: str, delay: float) -> None:
        try:
            await asyncio.sleep(delay)
            await self._flush_session(session_id, reason="retry", force=True)
            entry = self._cache.get(session_id)
            if entry is not None:
                entry.retry_attempts = 0
                entry.retry_task = None
        except asyncio.CancelledError:
            raise
        except Exception:
            self._schedule_retry(session_id)

    async def _flush_session(self, session_id: str, *, reason: str, force: bool = False) -> None:
        entry = self._cache.get(session_id)
        if entry is None:
            return

        async with entry.lock:
            if not force and not entry.dirty and not entry.write_queue:
                return

            snapshot = dict(entry.session.state)
            entry.enqueue_snapshot(snapshot, reason, max_size=self._queue_max_size)
            pending = entry.write_queue[-1]
            attempts = 0

            while attempts <= self._max_retries:
                row = await self._fetch_row(session_id)
                if not row:
                    raise RuntimeError(f"Session {session_id} not found when persisting state")

                expected_version = row.get("version", entry.version or 1)
                db_state = dict(row.get("state_snapshot") or {})
                merged_state = dict(db_state)
                merged_state.update(pending.snapshot)

                payload = {
                    "state_snapshot": merged_state,
                    "state_size_bytes": _json_size_bytes(merged_state),
                    "version": expected_version + 1,
                    "status": row.get("status", "active"),
                    "lag_ms": int(max(0.0, (time.time() - entry.last_mutation_at) * 1000)),
                    "token_usage": row.get("token_usage"),
                    "agent_name": entry.agent_name,
                    "app_name": entry.app_name,
                    "user_id": entry.user_id,
                    "last_heartbeat_at": _now_iso(),
                    "updated_at": _now_iso(),
                }

                try:
                    result = await _maybe_await(
                        self._table()
                        .update(payload)
                        .eq("session_key", session_id)
                        .eq("version", expected_version)
                        .execute()
                    )
                except Exception as exc:
                    entry.outage_error = str(exc)
                    raise

                data = getattr(result, "data", result)
                if data:
                    entry.session.state = merged_state
                    entry.session.last_update_time = time.time()
                    entry.version = expected_version + 1
                    entry.write_queue.clear()
                    entry.pending_delta.clear()
                    entry.dirty = False
                    entry.last_flush_at = time.time()
                    entry.outage_error = None
                    entry.retry_attempts = 0
                    return

                attempts += 1
                await asyncio.sleep(self._backoff_seconds * (2 ** attempts))

            entry.outage_error = "version_conflict"
            raise RuntimeError("Failed to persist session state due to version conflicts")

    async def _fetch_row(self, session_key: str) -> Optional[dict[str, Any]]:
        builder = self._table().select("*").eq("session_key", session_key).single()
        result = await _maybe_await(builder.execute())
        data = getattr(result, "data", result)
        return data

    def _table(self) -> Any:
        return self._client.table(self._table_name)

    def _loop(self) -> asyncio.AbstractEventLoop:
        try:
            return asyncio.get_running_loop()
        except RuntimeError:  # pragma: no cover - fallback for sync context
            return asyncio.get_event_loop()


# ---------------------------------------------------------------------------
# Factory -------------------------------------------------------------------
# ---------------------------------------------------------------------------


def create_session_service(
    *,
    supabase_client: Any | None = None,
    table_name: str = "mission_sessions",
    max_retries: int = 3,
    backoff_seconds: float = 0.2,
    eval_mode: Optional[bool] = None,
    heartbeat_seconds: float = 30.0,
    max_retry_backoff: float = 5.0,
    queue_max_size: int = 32,
) -> BaseSessionService:
    if eval_mode is None:
        eval_mode = _env_truthy(os.getenv("EVAL_MODE", ""))

    if eval_mode:
        return InMemorySessionService()

    if supabase_client is None:
        raise ValueError("Supabase client is required when EVAL_MODE is not truthy")

    return SupabaseSessionService(
        supabase_client,
        table_name=table_name,
        max_retries=max_retries,
        backoff_seconds=backoff_seconds,
        heartbeat_seconds=heartbeat_seconds,
        max_retry_backoff=max_retry_backoff,
        queue_max_size=queue_max_size,
    )
