"""Tests covering Composio catalog behaviour for missing toolkit scores."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import pytest

from agent.tools.composio_client import ComposioCatalogClient


@dataclass
class _StubTool:
    name: str
    slug: str
    description: str = ""
    toolkit: str = "test"
    meta: Optional[Dict[str, Any]] = None
    score: Optional[float] = None


def _make_client(items: List[Any]) -> ComposioCatalogClient:
    client = ComposioCatalogClient(api_key="dummy")
    class _StubTools:
        def __init__(self, values: List[Any]) -> None:
            self._values = values

        def get(self, *_args: Any, **_kwargs: Any) -> List[Any]:
            return list(self._values)

    client._sdk_client = type("SDK", (), {"tools": _StubTools(items)})()
    return client


def test_get_tools_missing_score_returns_none():
    tool = _StubTool(name="Tool", slug="tool")
    client = _make_client([tool])

    results = client.get_tools(limit=1)

    assert results[0]["score"] is None


def test_get_tools_missing_score_metadata_flag():
    tool = _StubTool(name="Tool", slug="tool")
    client = _make_client([tool])

    results = client.get_tools(limit=1)

    assert results[0]["palette"].get("score_available") is False


def test_get_tools_missing_score_current_behavior():
    tool = _StubTool(name="Tool", slug="tool")
    client = _make_client([tool])

    results = client.get_tools(limit=1)

    assert results[0]["score"] is None
