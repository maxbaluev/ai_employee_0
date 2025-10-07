"""Lightweight Composio catalog cache used during Gate G-A."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List


CATALOG_SOURCE = Path(__file__).resolve().parents[2] / "libs_docs" / "composio" / "llms.txt"


@dataclass(frozen=True)
class CatalogEntry:
    """Structured representation of a Composio documentation bullet."""

    title: str
    url: str
    description: str
    category: str


class ComposioCatalogClient:
    """Parse and cache curated Composio resources for planners."""

    def __init__(self, entries: List[CatalogEntry]) -> None:
        self.entries = entries
        canon = json.dumps([entry.__dict__ for entry in entries], sort_keys=True)
        self.checksum = hashlib.sha256(canon.encode("utf-8")).hexdigest()
        self.metadata = {
            "summary": {
                "total_entries": len(entries),
                "categories": sorted({entry.category for entry in entries}),
                "toolkits": len({entry.category for entry in entries}),
            },
            "checksum": self.checksum,
            "entries": [entry.__dict__ for entry in entries],
        }

    @classmethod
    def from_default_cache(cls) -> "ComposioCatalogClient":
        """Instantiate the client based on the bundled documentation."""

        entries = cls._parse_catalog(CATALOG_SOURCE)
        return cls(entries)

    @staticmethod
    def _parse_catalog(source: Path) -> List[CatalogEntry]:
        text = source.read_text(encoding="utf-8")
        bullet_pattern = re.compile(r"^- \[(?P<title>[^\]]+)\]\((?P<url>[^\)]+)\): (?P<description>.+)$")

        seen: Dict[str, CatalogEntry] = {}
        for line in text.splitlines():
            match = bullet_pattern.match(line.strip())
            if not match:
                continue
            title = match.group("title").strip()
            url = match.group("url").strip()
            description = match.group("description").strip()
            category = ComposioCatalogClient._derive_category(url)
            entry = CatalogEntry(title=title, url=url, description=description, category=category)
            seen_key = f"{category}:{title}"
            # If duplicate title within a category exists, keep the first reference.
            seen.setdefault(seen_key, entry)

        return sorted(seen.values(), key=lambda item: (item.category, item.title))

    @staticmethod
    def _derive_category(url: str) -> str:
        path = url.split("//")[-1]
        segments = path.split("/")
        # Skip domain portion (first segment contains domain)
        remaining = [segment for segment in segments[1:] if segment]
        if not remaining:
            return "general"
        slug = remaining[0]
        return slug.replace("-", "_")
