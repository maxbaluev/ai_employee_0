"""Minimal Composio catalog client built on the official SDK."""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()

LOGGER = logging.getLogger(__name__)


@dataclass
class CatalogSummary:
    """Snapshot of Composio toolkit metadata."""

    total_entries: int
    toolkits: List[Dict[str, Any]]
    categories: List[str]
    metadata: Dict[str, Any]

    def to_metadata(self) -> Dict[str, Any]:
        return {
            "summary": {
                "total_entries": self.total_entries,
                "toolkits": len(self.toolkits),
                "categories": len(self.categories),
                "source": self.metadata.get("source", "sdk"),
            },
            "toolkits": self.toolkits,
            "categories": self.categories,
        }


@dataclass
class ComposioCatalogClient:
    """Thin wrapper around the Composio SDK."""

    api_key: Optional[str] = None
    _sdk_client: Optional[Any] = None
    _summary: Optional[CatalogSummary] = None

    def __post_init__(self) -> None:
        if not self.api_key:
            LOGGER.warning(
                "COMPOSIO_API_KEY not set. Catalog discovery will return empty results."
            )
            return
        try:
            from composio import Composio

            self._sdk_client = Composio(api_key=self.api_key)
            LOGGER.debug("Initialised Composio SDK client")
        except ImportError:  # pragma: no cover - environment specific
            LOGGER.error("composio package not installed. Run `uv pip install composio`." )
            self._sdk_client = None
        except Exception as exc:  # pragma: no cover - defensive
            LOGGER.error("Failed to initialise Composio SDK: %s", exc)
            self._sdk_client = None

    @classmethod
    def from_env(cls) -> "ComposioCatalogClient":
        return cls(api_key=os.getenv("COMPOSIO_API_KEY"))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    @property
    def metadata(self) -> Dict[str, Any]:
        return self.get_summary().to_metadata()

    def get_summary(self) -> CatalogSummary:
        if self._summary is None:
            self._summary = self._fetch_summary()
        return self._summary

    def get_tools(
        self,
        *,
        toolkits: Optional[List[str]] = None,
        limit: int = 20,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if search and toolkits:
            raise ValueError("Composio filters must use either search or toolkits, not both")

        if not self._sdk_client:
            return []

        try:
            params: Dict[str, Any] = {"limit": min(limit, 50)}
            if toolkits:
                params["toolkits"] = toolkits
            if search:
                params["search"] = search
            tools = self._sdk_client.tools.get("mission-discovery", **params)
        except Exception as exc:  # pragma: no cover - defensive
            LOGGER.error("Failed to fetch tools via Composio SDK: %s", exc)
            return []

        return [
            {
                "name": getattr(tool, "name", "unknown"),
                "slug": getattr(tool, "slug", ""),
                "description": getattr(tool, "description", ""),
                "toolkit": getattr(tool, "toolkit", ""),
            }
            for tool in tools
        ]

    async def refresh(self) -> CatalogSummary:
        """Force a fresh SDK fetch and cache the summary."""
        self._summary = self._fetch_summary()
        return self._summary

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _fetch_summary(self) -> CatalogSummary:
        if not self._sdk_client:
            return CatalogSummary(
                total_entries=0,
                toolkits=[],
                categories=[],
                metadata={"source": "missing_api_key"},
            )

        LOGGER.info("Fetching Composio toolkit catalogue via SDK")
        try:
            response = self._sdk_client.toolkits.list(limit=50, sort_by="usage")
        except Exception as exc:  # pragma: no cover - defensive
            LOGGER.error("Composio SDK error: %s", exc)
            return CatalogSummary(
                total_entries=0,
                toolkits=[],
                categories=[],
                metadata={"source": "sdk_error", "detail": str(exc)},
            )

        toolkits: List[Dict[str, Any]] = []
        categories: set[str] = set()

        raw_records: Any = getattr(response, "items", response)

        # Normalise to a list of items regardless of SDK return type.
        if raw_records is None:
            iterable: List[Any] = []
        elif isinstance(raw_records, list):
            iterable = raw_records
        else:
            try:
                iterable = list(raw_records)
            except TypeError:  # pragma: no cover - defensive
                iterable = [raw_records]

        for record in iterable:
            name = getattr(record, "name", None) or "unknown"
            slug = getattr(record, "slug", None) or name

            meta_obj = getattr(record, "meta", None)
            if hasattr(meta_obj, "model_dump"):
                meta = meta_obj.model_dump()
            elif hasattr(meta_obj, "dict"):
                meta = meta_obj.dict()
            elif isinstance(meta_obj, dict):
                meta = meta_obj
            elif hasattr(meta_obj, "__dict__"):
                meta = dict(meta_obj.__dict__)
            else:
                meta = {}

            raw_categories = []
            if isinstance(meta, dict):
                raw_categories = meta.get("categories", []) or []

            resolved_category = getattr(record, "category", None)
            for cat in raw_categories:
                if isinstance(cat, dict):
                    candidate = cat.get("name") or cat.get("id")
                else:
                    candidate = getattr(cat, "name", None) or getattr(cat, "id", None)
                if candidate:
                    categories.add(candidate)
                    if not resolved_category:
                        resolved_category = candidate

            if not resolved_category:
                resolved_category = "general"

            raw_auth = getattr(record, "auth_schemes", [])
            if isinstance(raw_auth, (list, tuple)):
                auth_schemes = [str(scheme) for scheme in raw_auth if scheme]
            else:
                auth_schemes = []

            item = {
                "name": name,
                "slug": slug,
                "description": meta.get("description") if isinstance(meta, dict) else getattr(record, "description", ""),
                "category": resolved_category,
                "no_auth": bool(getattr(record, "no_auth", False)),
                "auth_schemes": auth_schemes,
                "logo": meta.get("logo") if isinstance(meta, dict) else None,
            }

            toolkits.append(item)
            categories.add(resolved_category)

        return CatalogSummary(
            total_entries=len(toolkits),
            toolkits=toolkits,
            categories=sorted(categories),
            metadata={"source": "sdk"},
        )


# ----------------------------------------------------------------------
# CLI helpers
# ----------------------------------------------------------------------
def _cli_status(client: ComposioCatalogClient) -> int:
    print("=== Composio Catalog Client Status ===")
    print(f"API key configured: {'yes' if client.api_key else 'no'}")

    summary = client.get_summary()
    print("\nCatalog summary:")
    print(f"  Source: {summary.metadata.get('source', 'sdk')}")
    print(f"  Total entries: {summary.total_entries}")
    print(f"  Toolkits: {len(summary.toolkits)}")
    print(f"  Categories: {len(summary.categories)}")
    return 0


async def _cli_refresh(client: ComposioCatalogClient) -> int:
    if not client.api_key:
        print("✗ COMPOSIO_API_KEY is required to refresh the catalog")
        return 1

    summary = await client.refresh()
    print("✓ Refreshed catalog from Composio SDK")
    print(f"  Total entries: {summary.total_entries}")
    print(f"  Toolkits: {len(summary.toolkits)}")
    print(f"  Categories: {len(summary.categories)}")
    return 0


def _main(argv: List[str]) -> int:
    logging.basicConfig(level=logging.INFO)
    client = ComposioCatalogClient.from_env()

    if "--status" in argv:
        return _cli_status(client)

    if "--refresh" in argv:
        return asyncio.run(_cli_refresh(client))

    print("Usage: python -m agent.tools.composio_client [--status | --refresh]")
    return 1


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    raise SystemExit(_main(os.sys.argv[1:]))
