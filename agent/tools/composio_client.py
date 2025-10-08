"""Lightweight Composio catalog cache used during Gate G-A."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List


@dataclass(frozen=True)
class CatalogEntry:
    """Structured representation of a Composio documentation bullet."""

    title: str
    url: str
    description: str
    category: str
