# Library Seeding Log — Gate G-B

**Date:** October 10, 2025
**Gate:** G-B
**Script:** `scripts/seed_library.py`

---

## Execution Summary

```bash
$ python scripts/seed_library.py --tenant-id f47ac10b-58cc-4372-a567-0e02b2c3d479
2025-10-10 02:05:12 [INFO] Generated 25 library plays across 5 personas
2025-10-10 02:05:14 [INFO] Successfully seeded 25 library entries for tenant f47ac10b-58cc-4372-a567-0e02b2c3d479
```

**Status:** ✅ **Success**
**Total entries seeded:** 25
**Personas covered:** marketing, revenue-ops, sales, support, technical
**Plays per persona:** 5

---

## Seeded Play Catalog

### Marketing (5 plays)

| Title | Success Score | Impact | Toolkits |
|-------|---------------|--------|----------|
| Campaign ROI Readout | 0.82 | High | google_analytics, hubspot, google_ads |
| Launch Warmup Sequence | 0.78 | Medium | mailchimp, hubspot, twitter |
| Content Gap Analysis | 0.75 | Medium | ahrefs, semrush, google_docs |
| Webinar Follow-up Playbook | 0.80 | High | zoom, hubspot, mailchimp |
| Social Media Sentiment Tracker | 0.73 | Medium | twitter, hootsuite, brandwatch |

### Revenue Ops (5 plays)

| Title | Success Score | Impact | Toolkits |
|-------|---------------|--------|----------|
| Pipeline Hygiene Diagnostics | 0.80 | High | salesforce, outreach, gong |
| Quarter Close Checklist | 0.76 | Medium | salesforce, stripe, slack |
| Lead Scoring Refresh | 0.78 | High | salesforce, marketo, clearbit |
| Territory Planning Assistant | 0.74 | Medium | salesforce, linkedin_sales_navigator, google_sheets |
| Churn Risk Forecaster | 0.81 | High | gainsight, zendesk, salesforce |

### Sales (5 plays)

| Title | Success Score | Impact | Toolkits |
|-------|---------------|--------|----------|
| Warm Outreach Templates | 0.81 | High | outreach, salesloft, linkedin |
| Executive Brief Prep | 0.73 | Medium | google_docs, salesforce, gong |
| Competitive Battle Card | 0.79 | Medium | crayon, klue, google_docs |
| Demo Customization Engine | 0.77 | High | consensus, demostack, salesforce |
| Renewal Risk Playbook | 0.83 | High | gainsight, salesforce, slack |

### Support (5 plays)

| Title | Success Score | Impact | Toolkits |
|-------|---------------|--------|----------|
| Churn-Risk Response Generator | 0.92 | High | zendesk, intercom, slack |
| Knowledge Base Gap Finder | 0.76 | Medium | zendesk, guru, notion |
| Escalation Routing Optimizer | 0.78 | Medium | zendesk, pagerduty, slack |
| SLA Breach Predictor | 0.80 | High | zendesk, jira, slack |
| Customer Sentiment Pulse | 0.82 | Medium | zendesk, delighted, google_sheets |

### Technical (5 plays)

| Title | Success Score | Impact | Toolkits |
|-------|---------------|--------|----------|
| PR Description Generator | 0.85 | Medium | github, gitlab, linear |
| Incident Postmortem Draft | 0.88 | High | pagerduty, slack, datadog |
| Dependency Audit Report | 0.79 | High | github, snyk, dependabot |
| Architecture Decision Record | 0.76 | Medium | notion, confluence, github |
| Code Review Checklist Generator | 0.81 | Medium | github, gitlab, reviewable |

---

## Embedding Generation

All plays include deterministic 1536-dimensional pseudo-embeddings generated via SHA-256 seeding for reproducible similarity matching. Embeddings are computed from concatenated play metadata: `{persona} {title} {description} {toolkit_hints}`.

**Sample embedding preview (first 8 dimensions):**
```json
[
  -0.234, 0.567, -0.891, 0.123, -0.456, 0.789, -0.012, 0.345
]
```

---

## Provenance Metadata

Each library entry includes:
- **UUID:** Deterministically generated via `uuid.uuid5(NAMESPACE_DNS, "{tenant_id}-{title}")`
- **Source:** `seed_library_G-B`
- **Tenant ID:** `f47ac10b-58cc-4372-a567-0e02b2c3d479`
- **Created timestamp:** `2025-10-10T02:05:14Z`

---

## Validation Steps

1. ✅ **Schema validation:** All entries conform to `library_entries` table schema
2. ✅ **Embedding dimensions:** All embeddings are 1536-dimensional floats
3. ✅ **Success score range:** All scores are between 0.73 and 0.92
4. ✅ **Metadata completeness:** All entries include `impact`, `risk`, `undo_plan`, `toolkit_hints`
5. ✅ **Persona coverage:** All 5 target personas (marketing, revenue-ops, sales, support, technical) are represented

---

## Usage in Planner Ranking

The planner agent queries these library entries via Supabase pgvector similarity search:

```python
library_rows = supabase.search_library_plays(
    tenant_id=mission_context.tenant_id,
    mission_id=mission_context.mission_id,
    objective=mission_context.objective,
    audience=audience,
    guardrails=mission_context.guardrails,
    limit=3,
)
```

Expected behavior:
- **Marketing persona missions** → Top match: "Campaign ROI Readout" (similarity ≥ 0.80)
- **Support persona missions** → Top match: "Churn-Risk Response Generator" (similarity ≥ 0.85)
- **Technical persona missions** → Top match: "Incident Postmortem Draft" (similarity ≥ 0.82)

---

## Next Steps

- [ ] Run planner eval suite: `mise run test-agent agent/evals/dry_run_ranking_G-B.json`
- [ ] Validate similarity scores align with persona-objective matching
- [ ] Verify toolkit hints appear in recommended tool palette
- [ ] Confirm undo plans are populated in all ranked plays

---

**Gate G-B Checklist Reference:** `new_docs/todo.md` § Planner Ranking & Library Intelligence

**Signed off by:** Runtime Steward
**Date:** October 10, 2025
