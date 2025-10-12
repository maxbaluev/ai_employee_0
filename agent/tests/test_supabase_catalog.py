"""Unit tests for Supabase catalog availability handling."""

from __future__ import annotations

import pytest

from agent.services.supabase import CatalogUnavailableError, SupabaseClient


VALID_MISSION = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
VALID_TENANT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


class _SupabaseStub(SupabaseClient):
    def __init__(self, *, response) -> None:  # type: ignore[override]
        super().__init__(url="https://example.test", api_key="key")
        self._response = response

    def _request(self, *_args, **_kwargs):  # type: ignore[override]
        return self._response


def test_fetch_safeguards_raises_when_disabled():
    client = SupabaseClient(url=None, api_key=None)
    with pytest.raises(CatalogUnavailableError):
        client.fetch_safeguards(mission_id=VALID_MISSION, tenant_id=VALID_TENANT)


def test_fetch_safeguards_raises_on_empty_response():
    client = _SupabaseStub(response=[])
    with pytest.raises(CatalogUnavailableError):
        client.fetch_safeguards(mission_id=VALID_MISSION, tenant_id=VALID_TENANT)


def test_search_library_plays_raises_when_unavailable():
    client = SupabaseClient(url=None, api_key=None)
    with pytest.raises(CatalogUnavailableError):
        client.search_library_plays(
            tenant_id=VALID_TENANT,
            mission_id=VALID_MISSION,
            objective="Increase pipeline",
            audience="Revenue",
            guardrails=["tone"],
            limit=3,
        )


def test_search_library_plays_raises_on_empty_catalog():
    client = _SupabaseStub(response=[])
    with pytest.raises(CatalogUnavailableError):
        client.search_library_plays(
            tenant_id=VALID_TENANT,
            mission_id=VALID_MISSION,
            objective="Increase pipeline",
            audience="Revenue",
            guardrails=["tone"],
            limit=3,
        )


def test_fetch_latest_inspection_finding_returns_none_when_disabled():
    client = SupabaseClient(url=None, api_key=None)
    assert (
        client.fetch_latest_inspection_finding(
            mission_id=VALID_MISSION,
            tenant_id=VALID_TENANT,
        )
        is None
    )


def test_fetch_latest_inspection_finding_returns_latest_row():
    candidate = {
        "id": "finding-001",
        "mission_id": VALID_MISSION,
        "tenant_id": VALID_TENANT,
        "readiness": 92,
    }
    client = _SupabaseStub(response=[candidate])
    result = client.fetch_latest_inspection_finding(
        mission_id=VALID_MISSION,
        tenant_id=VALID_TENANT,
    )
    assert result == candidate
