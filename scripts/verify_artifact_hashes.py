#!/usr/bin/env python3
"""Verify that evidence artifact hashes match their stored payload."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


def _hash_payload(payload: Any) -> str:
    if isinstance(payload, (dict, list)):
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return hashlib.sha256(str(payload).encode("utf-8")).hexdigest()


def verify_hashes(path: Path) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    artifacts = data.get("artifacts") or []
    if not isinstance(artifacts, list):
        raise ValueError("Expected 'artifacts' array in evidence bundle")

    mismatches = []
    skipped = 0

    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue
        stored_hash = artifact.get("hash") or artifact.get("checksum")
        content = artifact.get("content")
        if not stored_hash:
            skipped += 1
            continue
        if content is None:
            skipped += 1
            continue
        calculated = _hash_payload(content)
        if calculated != stored_hash:
            mismatches.append(
                {
                    "title": artifact.get("title"),
                    "expected": stored_hash,
                    "calculated": calculated,
                }
            )

    if mismatches:
        print("Artifact hash mismatches detected:\n")
        for mismatch in mismatches:
            print(
                f"- {mismatch['title'] or 'artifact'}:\n"
                f"  expected={mismatch['expected']}\n"
                f"  calculated={mismatch['calculated']}"
            )
        return 1

    print("All artifact hashes verified successfully.")
    if skipped:
        print(f"Skipped {skipped} artifact(s) lacking inline content; see storage refs.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify evidence artifact hashes")
    parser.add_argument(
        "bundle",
        nargs="?",
        default="docs/readiness/evidence_bundle_sample_G-B.json",
        help="Path to evidence bundle JSON",
    )
    args = parser.parse_args()

    bundle_path = Path(args.bundle)
    if not bundle_path.exists():
        raise FileNotFoundError(bundle_path)
    return verify_hashes(bundle_path)


if __name__ == "__main__":
    raise SystemExit(main())
