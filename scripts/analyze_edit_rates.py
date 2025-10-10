#!/usr/bin/env python3
"""Analyze generative quality metrics for Gate G-B validation."""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
LOGGER = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Data models
# ------------------------------------------------------------------
@dataclass
class EditMetrics:
    """Aggregated edit and acceptance metrics for generative quality."""

    field: str
    total_generated: int
    accepted_count: int
    edited_count: int
    regenerated_count: int
    average_confidence: float
    acceptance_rate: float
    edit_rate: float
    regeneration_rate: float


@dataclass
class PersonaMetrics:
    """Metrics grouped by persona."""

    persona: str
    mission_count: int
    field_metrics: List[EditMetrics]
    overall_acceptance_rate: float
    overall_edit_rate: float
    median_regenerations: float
    safeguard_adoption_rate: float


# ------------------------------------------------------------------
# Supabase client
# ------------------------------------------------------------------
class SupabaseClient:
    """Minimal REST wrapper for querying mission metadata."""

    def __init__(self, url: str, api_key: str) -> None:
        self.url = url.rstrip("/")
        self.api_key = api_key
        self._rest_url = f"{self.url}/rest/v1"

    @classmethod
    def from_env(cls) -> "SupabaseClient":
        url = (
            os.getenv("SUPABASE_URL")
            or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            or os.getenv("SUPABASE_PROJECT_URL")
        )
        key = (
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_SERVICE_KEY")
            or os.getenv("SUPABASE_ANON_KEY")
        )
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        return cls(url, key)

    def fetch_mission_metadata(
        self,
        *,
        tenant_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Fetch mission metadata rows for analysis."""
        params = {
            "order": "created_at.desc",
            "limit": str(limit),
        }
        if tenant_id:
            params["tenant_id"] = f"eq.{tenant_id}"

        url = f"{self._rest_url}/mission_metadata"
        query = urllib.parse.urlencode(params, doseq=True)
        full_url = f"{url}?{query}"

        request = urllib.request.Request(full_url, method="GET")
        request.add_header("apikey", self.api_key)
        request.add_header("Authorization", f"Bearer {self.api_key}")
        request.add_header("Cache-Control", "no-cache")

        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                data = response.read().decode("utf-8")
                return json.loads(data) if data else []
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8") if exc.fp else exc.reason
            LOGGER.error("Supabase HTTP %s: %s", exc.code, detail)
            return []
        except Exception as exc:
            LOGGER.error("Supabase request error: %s", exc)
            return []

    def fetch_safeguard_hints(
        self,
        *,
        tenant_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Fetch safeguard hints for adoption analysis."""
        params = {
            "order": "updated_at.desc",
            "limit": str(limit),
        }
        if tenant_id:
            params["tenant_id"] = f"eq.{tenant_id}"

        url = f"{self._rest_url}/mission_safeguards"
        query = urllib.parse.urlencode(params, doseq=True)
        full_url = f"{url}?{query}"

        request = urllib.request.Request(full_url, method="GET")
        request.add_header("apikey", self.api_key)
        request.add_header("Authorization", f"Bearer {self.api_key}")
        request.add_header("Cache-Control", "no-cache")

        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                data = response.read().decode("utf-8")
                return json.loads(data) if data else []
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8") if exc.fp else exc.reason
            LOGGER.error("Supabase HTTP %s: %s", exc.code, detail)
            return []
        except Exception as exc:
            LOGGER.error("Supabase request error: %s", exc)
            return []


# ------------------------------------------------------------------
# Analysis logic
# ------------------------------------------------------------------
def analyze_edit_rates(
    *,
    tenant_id: Optional[str] = None,
    output_file: Optional[str] = None,
) -> None:
    """Analyze generative quality metrics from mission metadata."""
    client = SupabaseClient.from_env()

    # Fetch data
    LOGGER.info("Fetching mission metadata...")
    metadata_rows = client.fetch_mission_metadata(tenant_id=tenant_id, limit=500)
    LOGGER.info("Fetched %d mission metadata rows", len(metadata_rows))

    LOGGER.info("Fetching safeguard hints...")
    safeguard_rows = client.fetch_safeguard_hints(tenant_id=tenant_id, limit=500)
    LOGGER.info("Fetched %d safeguard hint rows", len(safeguard_rows))

    if not metadata_rows:
        LOGGER.warning("No mission metadata found - cannot analyze edit rates")
        return

    # Group by mission and field
    mission_fields: Dict[str, Dict[str, List[Dict[str, Any]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for row in metadata_rows:
        mission_id = row.get("mission_id")
        field = row.get("field")
        if mission_id and field:
            mission_fields[mission_id][field].append(row)

    # Compute field-level metrics
    field_stats: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for mission_id, fields in mission_fields.items():
        for field, rows in fields.items():
            # Sort by created_at to get chronological order
            sorted_rows = sorted(rows, key=lambda r: r.get("created_at", ""))

            # Identify source status
            accepted = any(r.get("source") == "accepted" for r in sorted_rows)
            edited = any(r.get("source") == "edited" for r in sorted_rows)
            regenerated_count = sum(1 for r in sorted_rows if r.get("source") == "generated")

            # Get confidence (use latest)
            confidence = float(sorted_rows[-1].get("confidence", 0.0))

            field_stats[field].append({
                "mission_id": mission_id,
                "accepted": accepted,
                "edited": edited,
                "regenerated_count": max(regenerated_count - 1, 0),  # Exclude first generation
                "confidence": confidence,
            })

    # Aggregate metrics per field
    edit_metrics: List[EditMetrics] = []
    for field, stats in field_stats.items():
        total = len(stats)
        accepted = sum(1 for s in stats if s["accepted"])
        edited = sum(1 for s in stats if s["edited"])
        regenerated = sum(s["regenerated_count"] for s in stats)
        avg_confidence = sum(s["confidence"] for s in stats) / total if total > 0 else 0.0

        edit_metrics.append(
            EditMetrics(
                field=field,
                total_generated=total,
                accepted_count=accepted,
                edited_count=edited,
                regenerated_count=regenerated,
                average_confidence=avg_confidence,
                acceptance_rate=accepted / total if total > 0 else 0.0,
                edit_rate=edited / total if total > 0 else 0.0,
                regeneration_rate=regenerated / total if total > 0 else 0.0,
            )
        )

    # Analyze safeguard adoption
    safeguard_stats = {
        "suggested": 0,
        "accepted": 0,
        "edited": 0,
        "rejected": 0,
    }
    for row in safeguard_rows:
        status = row.get("status", "suggested")
        if status in safeguard_stats:
            safeguard_stats[status] += 1

    total_safeguards = sum(safeguard_stats.values())
    safeguard_adoption_rate = (
        (safeguard_stats["accepted"] + safeguard_stats["edited"]) / total_safeguards
        if total_safeguards > 0
        else 0.0
    )

    # Calculate summary metrics first
    overall_acceptance_rate = (
        sum(m.accepted_count for m in edit_metrics)
        / sum(m.total_generated for m in edit_metrics)
        if edit_metrics
        else 0.0
    )
    overall_edit_rate = (
        sum(m.edited_count for m in edit_metrics)
        / sum(m.total_generated for m in edit_metrics)
        if edit_metrics
        else 0.0
    )
    median_regenerations = (
        sum(m.regenerated_count for m in edit_metrics)
        / len(edit_metrics)
        if edit_metrics
        else 0.0
    )

    # Generate report
    report = {
        "gate": "G-B",
        "timestamp": "2025-10-10",
        "tenant_id": tenant_id or "all",
        "summary": {
            "total_missions": len(mission_fields),
            "total_fields_generated": sum(m.total_generated for m in edit_metrics),
            "overall_acceptance_rate": overall_acceptance_rate,
            "overall_edit_rate": overall_edit_rate,
            "median_regenerations": median_regenerations,
            "safeguard_adoption_rate": safeguard_adoption_rate,
        },
        "field_metrics": [
            {
                "field": m.field,
                "total_generated": m.total_generated,
                "acceptance_rate": round(m.acceptance_rate, 3),
                "edit_rate": round(m.edit_rate, 3),
                "regeneration_rate": round(m.regeneration_rate, 3),
                "average_confidence": round(m.average_confidence, 3),
            }
            for m in sorted(edit_metrics, key=lambda x: x.acceptance_rate, reverse=True)
        ],
        "safeguard_stats": safeguard_stats,
        "gate_g_b_thresholds": {
            "target_acceptance_rate": 0.70,
            "max_median_regenerations": 3.0,
            "min_safeguard_adoption": 0.60,
        },
        "compliance": {
            "acceptance_threshold_met": overall_acceptance_rate >= 0.70,
            "regeneration_threshold_met": median_regenerations <= 3.0,
            "safeguard_threshold_met": safeguard_adoption_rate >= 0.60,
        },
    }

    # Print summary
    print("\n" + "=" * 70)
    print("Gate G-B Generative Quality Analysis")
    print("=" * 70)
    print(f"Total missions analyzed: {report['summary']['total_missions']}")
    print(f"Total fields generated: {report['summary']['total_fields_generated']}")
    print(f"\nOverall acceptance rate: {report['summary']['overall_acceptance_rate']:.1%}")
    print(f"Overall edit rate: {report['summary']['overall_edit_rate']:.1%}")
    print(f"Median regenerations per field: {report['summary']['median_regenerations']:.2f}")
    print(f"Safeguard adoption rate: {report['summary']['safeguard_adoption_rate']:.1%}")
    print(f"\nGate G-B Compliance:")
    print(f"  ✓ Acceptance ≥70%: {'PASS' if report['compliance']['acceptance_threshold_met'] else 'FAIL'}")
    print(f"  ✓ Regenerations ≤3: {'PASS' if report['compliance']['regeneration_threshold_met'] else 'FAIL'}")
    print(f"  ✓ Safeguard adoption ≥60%: {'PASS' if report['compliance']['safeguard_threshold_met'] else 'FAIL'}")
    print("=" * 70)
    print("\nField-level breakdown:")
    for field_metric in report["field_metrics"][:5]:  # Top 5 fields
        print(
            f"  {field_metric['field']:20} | "
            f"accept={field_metric['acceptance_rate']:.1%} | "
            f"edit={field_metric['edit_rate']:.1%} | "
            f"regen={field_metric['regeneration_rate']:.2f} | "
            f"conf={field_metric['average_confidence']:.2f}"
        )

    # Save to file
    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        LOGGER.info("Report saved to %s", output_file)


# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Analyze generative quality metrics for Gate G-B"
    )
    parser.add_argument(
        "--tenant-id",
        help="Filter by tenant UUID",
    )
    parser.add_argument(
        "--output",
        default="docs/readiness/generative_quality_report_G-B.json",
        help="Output file path",
    )
    args = parser.parse_args()

    try:
        analyze_edit_rates(
            tenant_id=args.tenant_id,
            output_file=args.output,
        )
        return 0
    except Exception as exc:
        LOGGER.exception("Analysis failed: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
