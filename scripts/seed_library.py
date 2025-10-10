#!/usr/bin/env python3
"""Seed library entries for Gate G-B planner ranking evaluation."""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import random
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
LOGGER = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------
PERSONAS = ["marketing", "revenue-ops", "sales", "support", "technical"]
PLAYS_PER_PERSONA = 5


# ------------------------------------------------------------------
# Data models
# ------------------------------------------------------------------
@dataclass
class LibraryPlay:
    """Template for a reusable AI Employee play."""

    title: str
    description: str
    persona: str
    success_score: float
    impact: str
    risk: str
    undo_plan: str
    embedding: List[float]
    metadata: Dict[str, Any]


# ------------------------------------------------------------------
# Supabase client
# ------------------------------------------------------------------
class SupabaseClient:
    """Minimal REST wrapper for seeding library entries."""

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

    def insert_library_entries(self, entries: List[Dict[str, Any]]) -> None:
        """Insert library entries via PostgREST."""
        if not entries:
            LOGGER.warning("No entries to insert")
            return

        url = f"{self._rest_url}/library_entries"
        data = json.dumps(entries).encode("utf-8")

        request = urllib.request.Request(url, data=data, method="POST")
        request.add_header("apikey", self.api_key)
        request.add_header("Authorization", f"Bearer {self.api_key}")
        request.add_header("Content-Type", "application/json")
        request.add_header("Prefer", "return=minimal")

        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                LOGGER.info(
                    "Inserted %d entries: HTTP %d", len(entries), response.status
                )
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8") if exc.fp else exc.reason
            LOGGER.error("Supabase HTTP %s: %s", exc.code, detail)
            raise
        except Exception as exc:
            LOGGER.error("Supabase request error: %s", exc)
            raise


# ------------------------------------------------------------------
# Play catalog
# ------------------------------------------------------------------
def generate_plays() -> List[LibraryPlay]:
    """Generate library plays for each persona."""
    catalog: List[LibraryPlay] = []

    # Marketing plays
    catalog.extend(
        [
            LibraryPlay(
                title="Campaign ROI Readout",
                description="Summarise paid campaign performance, identify top-converting channels, and outline next experiments with attribution data.",
                persona="marketing",
                success_score=0.82,
                impact="High",
                risk="Low",
                undo_plan="Revert to previous reporting template and restore baseline metrics snapshot",
                embedding=_fake_embedding(
                    "marketing campaign roi reporting attribution"
                ),
                metadata={
                    "toolkit_hints": ["google_analytics", "hubspot", "google_ads"]
                },
            ),
            LibraryPlay(
                title="Launch Warmup Sequence",
                description="Prepare nurture email drafts and social cues for upcoming product launch window with persona-specific messaging.",
                persona="marketing",
                success_score=0.78,
                impact="Medium",
                risk="Low",
                undo_plan="Pause nurture flow, notify stakeholders, and revert to previous sequence template",
                embedding=_fake_embedding("marketing launch email nurture social"),
                metadata={"toolkit_hints": ["mailchimp", "hubspot", "twitter"]},
            ),
            LibraryPlay(
                title="Content Gap Analysis",
                description="Identify missing content topics based on search trends, competitor coverage, and existing blog inventory.",
                persona="marketing",
                success_score=0.75,
                impact="Medium",
                risk="Low",
                undo_plan="Restore previous content calendar and archive gap analysis report",
                embedding=_fake_embedding("marketing content seo blog analysis"),
                metadata={"toolkit_hints": ["ahrefs", "semrush", "google_docs"]},
            ),
            LibraryPlay(
                title="Webinar Follow-up Playbook",
                description="Generate personalized follow-up email sequences for webinar attendees segmented by engagement level.",
                persona="marketing",
                success_score=0.80,
                impact="High",
                risk="Low",
                undo_plan="Delete drafted sequences and restore previous webinar follow-up template",
                embedding=_fake_embedding(
                    "marketing webinar email follow-up engagement"
                ),
                metadata={"toolkit_hints": ["zoom", "hubspot", "mailchimp"]},
            ),
            LibraryPlay(
                title="Social Media Sentiment Tracker",
                description="Monitor brand mentions across social channels, flag negative sentiment spikes, and generate response templates.",
                persona="marketing",
                success_score=0.73,
                impact="Medium",
                risk="Moderate",
                undo_plan="Disable sentiment alerts and revert to manual monitoring workflow",
                embedding=_fake_embedding(
                    "marketing social sentiment monitoring alerts"
                ),
                metadata={"toolkit_hints": ["twitter", "hootsuite", "brandwatch"]},
            ),
        ]
    )

    # Revenue ops plays
    catalog.extend(
        [
            LibraryPlay(
                title="Pipeline Hygiene Diagnostics",
                description="Assess Salesforce pipeline hygiene, flag stale deals, missing fields, and recommend cleanup actions.",
                persona="revenue-ops",
                success_score=0.80,
                impact="High",
                risk="Moderate",
                undo_plan="Restore previous field mappings and pipeline stage definitions",
                embedding=_fake_embedding(
                    "revenue ops salesforce pipeline hygiene diagnostics"
                ),
                metadata={"toolkit_hints": ["salesforce", "outreach", "gong"]},
            ),
            LibraryPlay(
                title="Quarter Close Checklist",
                description="Generate dry-run close plan covering approvals, discounting exceptions, billing milestones, and stakeholder sign-offs.",
                persona="revenue-ops",
                success_score=0.76,
                impact="Medium",
                risk="Low",
                undo_plan="Reinstate prior approval routing and restore previous quarter close workflow",
                embedding=_fake_embedding(
                    "revenue ops quarter close approvals billing"
                ),
                metadata={"toolkit_hints": ["salesforce", "stripe", "slack"]},
            ),
            LibraryPlay(
                title="Lead Scoring Refresh",
                description="Analyze conversion patterns, recalibrate lead scoring thresholds, and generate updated routing rules.",
                persona="revenue-ops",
                success_score=0.78,
                impact="High",
                risk="Moderate",
                undo_plan="Revert to previous scoring model and restore routing rules snapshot",
                embedding=_fake_embedding(
                    "revenue ops lead scoring routing conversion"
                ),
                metadata={"toolkit_hints": ["salesforce", "marketo", "clearbit"]},
            ),
            LibraryPlay(
                title="Territory Planning Assistant",
                description="Draft territory assignments based on account coverage, rep capacity, and strategic priorities.",
                persona="revenue-ops",
                success_score=0.74,
                impact="Medium",
                risk="Moderate",
                undo_plan="Restore previous territory assignments and notify affected reps",
                embedding=_fake_embedding("revenue ops territory planning assignments"),
                metadata={
                    "toolkit_hints": [
                        "salesforce",
                        "linkedin_sales_navigator",
                        "google_sheets",
                    ]
                },
            ),
            LibraryPlay(
                title="Churn Risk Forecaster",
                description="Identify high-risk accounts based on usage trends, support tickets, and engagement signals.",
                persona="revenue-ops",
                success_score=0.81,
                impact="High",
                risk="Low",
                undo_plan="Archive risk forecast and restore previous account health scoring",
                embedding=_fake_embedding("revenue ops churn risk forecast health"),
                metadata={"toolkit_hints": ["gainsight", "zendesk", "salesforce"]},
            ),
        ]
    )

    # Sales plays
    catalog.extend(
        [
            LibraryPlay(
                title="Warm Outreach Templates",
                description="Draft personalized outreach templates and meeting agendas for warm enterprise prospects.",
                persona="sales",
                success_score=0.81,
                impact="High",
                risk="Low",
                undo_plan="Revert to previous messaging variant and delete drafts",
                embedding=_fake_embedding(
                    "sales outreach templates enterprise prospects"
                ),
                metadata={"toolkit_hints": ["outreach", "salesloft", "linkedin"]},
            ),
            LibraryPlay(
                title="Executive Brief Prep",
                description="Compile win themes, blockers, and ask ladder for upcoming executive sponsor sync.",
                persona="sales",
                success_score=0.73,
                impact="Medium",
                risk="Moderate",
                undo_plan="Share prior QBR deck instead and archive new brief",
                embedding=_fake_embedding("sales executive brief qbr sponsor"),
                metadata={"toolkit_hints": ["google_docs", "salesforce", "gong"]},
            ),
            LibraryPlay(
                title="Competitive Battle Card",
                description="Generate competitive positioning guide with objection handling and differentiation points.",
                persona="sales",
                success_score=0.79,
                impact="Medium",
                risk="Low",
                undo_plan="Restore previous battle card version and archive updates",
                embedding=_fake_embedding("sales competitive battle card positioning"),
                metadata={"toolkit_hints": ["crayon", "klue", "google_docs"]},
            ),
            LibraryPlay(
                title="Demo Customization Engine",
                description="Tailor product demo flow based on prospect industry, use case, and stakeholder personas.",
                persona="sales",
                success_score=0.77,
                impact="High",
                risk="Low",
                undo_plan="Revert to standard demo flow and delete customizations",
                embedding=_fake_embedding("sales demo customization industry use case"),
                metadata={"toolkit_hints": ["consensus", "demostack", "salesforce"]},
            ),
            LibraryPlay(
                title="Renewal Risk Playbook",
                description="Flag at-risk renewals, generate retention offers, and draft executive escalation paths.",
                persona="sales",
                success_score=0.83,
                impact="High",
                risk="Moderate",
                undo_plan="Restore previous renewal workflow and notify CSM team",
                embedding=_fake_embedding("sales renewal risk retention escalation"),
                metadata={"toolkit_hints": ["gainsight", "salesforce", "slack"]},
            ),
        ]
    )

    # Support plays
    catalog.extend(
        [
            LibraryPlay(
                title="Churn-Risk Response Generator",
                description="Draft safeguarded, tone-appropriate responses for high-priority support cases flagged for churn risk.",
                persona="support",
                success_score=0.92,
                impact="High",
                risk="Low",
                undo_plan="Delete draft responses and revert ticket status to open",
                embedding=_fake_embedding("support churn risk response tone safeguard"),
                metadata={"toolkit_hints": ["zendesk", "intercom", "slack"]},
            ),
            LibraryPlay(
                title="Knowledge Base Gap Finder",
                description="Identify recurring ticket themes missing from help docs and generate draft articles.",
                persona="support",
                success_score=0.76,
                impact="Medium",
                risk="Low",
                undo_plan="Archive draft articles and restore previous content roadmap",
                embedding=_fake_embedding(
                    "support knowledge base gap recurring tickets"
                ),
                metadata={"toolkit_hints": ["zendesk", "guru", "notion"]},
            ),
            LibraryPlay(
                title="Escalation Routing Optimizer",
                description="Analyze escalation patterns, recommend routing rule updates, and draft escalation playbooks.",
                persona="support",
                success_score=0.78,
                impact="Medium",
                risk="Moderate",
                undo_plan="Restore previous routing rules and notify support leads",
                embedding=_fake_embedding(
                    "support escalation routing patterns optimize"
                ),
                metadata={"toolkit_hints": ["zendesk", "pagerduty", "slack"]},
            ),
            LibraryPlay(
                title="SLA Breach Predictor",
                description="Forecast SLA breach risk based on queue depth, agent availability, and ticket complexity.",
                persona="support",
                success_score=0.80,
                impact="High",
                risk="Low",
                undo_plan="Disable breach alerts and revert to manual SLA monitoring",
                embedding=_fake_embedding("support sla breach forecast queue"),
                metadata={"toolkit_hints": ["zendesk", "jira", "slack"]},
            ),
            LibraryPlay(
                title="Customer Sentiment Pulse",
                description="Aggregate CSAT scores, NPS feedback, and ticket sentiment to generate weekly health report.",
                persona="support",
                success_score=0.82,
                impact="Medium",
                risk="Low",
                undo_plan="Archive report and restore previous dashboard template",
                embedding=_fake_embedding("support sentiment csat nps health report"),
                metadata={"toolkit_hints": ["zendesk", "delighted", "google_sheets"]},
            ),
        ]
    )

    # Technical plays
    catalog.extend(
        [
            LibraryPlay(
                title="PR Description Generator",
                description="Generate comprehensive pull request descriptions with context, testing notes, and rollback steps.",
                persona="technical",
                success_score=0.85,
                impact="Medium",
                risk="Low",
                undo_plan="Revert PR description to manual draft and delete generated content",
                embedding=_fake_embedding("technical pr description testing rollback"),
                metadata={"toolkit_hints": ["github", "gitlab", "linear"]},
            ),
            LibraryPlay(
                title="Incident Postmortem Draft",
                description="Compile incident timeline, root cause analysis, and remediation action items from logs and Slack threads.",
                persona="technical",
                success_score=0.88,
                impact="High",
                risk="Low",
                undo_plan="Archive draft postmortem and restore previous incident template",
                embedding=_fake_embedding(
                    "technical incident postmortem root cause timeline"
                ),
                metadata={"toolkit_hints": ["pagerduty", "slack", "datadog"]},
            ),
            LibraryPlay(
                title="Dependency Audit Report",
                description="Scan repository dependencies, flag security vulnerabilities, and generate upgrade recommendations.",
                persona="technical",
                success_score=0.79,
                impact="High",
                risk="Moderate",
                undo_plan="Restore previous dependency versions and archive audit report",
                embedding=_fake_embedding(
                    "technical dependency security vulnerability audit"
                ),
                metadata={"toolkit_hints": ["github", "snyk", "dependabot"]},
            ),
            LibraryPlay(
                title="Architecture Decision Record",
                description="Generate ADR template populated with context, options considered, and decision rationale.",
                persona="technical",
                success_score=0.76,
                impact="Medium",
                risk="Low",
                undo_plan="Delete draft ADR and restore previous architecture docs",
                embedding=_fake_embedding("technical architecture decision record adr"),
                metadata={"toolkit_hints": ["notion", "confluence", "github"]},
            ),
            LibraryPlay(
                title="Code Review Checklist Generator",
                description="Create context-specific review checklists based on file changes, language, and team standards.",
                persona="technical",
                success_score=0.81,
                impact="Medium",
                risk="Low",
                undo_plan="Revert to standard checklist template and delete custom version",
                embedding=_fake_embedding("technical code review checklist standards"),
                metadata={"toolkit_hints": ["github", "gitlab", "reviewable"]},
            ),
        ]
    )

    return catalog


# ------------------------------------------------------------------
# Embedding simulation
# ------------------------------------------------------------------
def _fake_embedding(text: str, dimensions: int = 1536) -> List[float]:
    """Generate deterministic pseudo-embedding for Gate G-B seeding."""
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    seed = int(digest[:8], 16)
    rng = random.Random(seed)
    return [rng.uniform(-1.0, 1.0) for _ in range(dimensions)]


# ------------------------------------------------------------------
# Main seeding logic
# ------------------------------------------------------------------
def seed_library(
    *,
    tenant_id: str,
    dry_run: bool = False,
) -> None:
    """Seed library entries for Gate G-B planner evaluation."""
    plays = generate_plays()

    LOGGER.info(
        "Generated %d library plays across %d personas", len(plays), len(PERSONAS)
    )

    if dry_run:
        LOGGER.info("Dry-run mode: skipping Supabase insert")
        for play in plays:
            print(
                f"  - {play.persona:15} | {play.title} (success={play.success_score:.2f})"
            )
        return

    # Convert to Supabase records
    entries: List[Dict[str, Any]] = []
    for play in plays:
        entry = {
            "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{tenant_id}-{play.title}")),
            "tenant_id": tenant_id,
            "title": play.title,
            "description": play.description,
            "persona": play.persona,
            "success_score": play.success_score,
            "embedding": play.embedding,
            "metadata": {
                "impact": play.impact,
                "risk": play.risk,
                "undo_plan": play.undo_plan,
                **play.metadata,
            },
            "source": "seed_library_G-B",
        }
        entries.append(entry)

    # Insert to Supabase
    client = SupabaseClient.from_env()
    client.insert_library_entries(entries)

    LOGGER.info(
        "Successfully seeded %d library entries for tenant %s", len(entries), tenant_id
    )


# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="Seed library entries for Gate G-B")
    parser.add_argument(
        "--tenant-id",
        default=os.getenv("DEFAULT_TENANT_ID", str(uuid.uuid4())),
        help="Tenant UUID for library entries",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview library plays without inserting into Supabase",
    )
    args = parser.parse_args()

    try:
        seed_library(
            tenant_id=args.tenant_id,
            dry_run=args.dry_run,
        )
        return 0
    except Exception as exc:
        LOGGER.exception("Seeding failed: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
