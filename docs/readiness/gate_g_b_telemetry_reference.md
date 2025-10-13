# Gate G-B Telemetry Reference

**Last updated:** 2025-10-13

This document captures the canonical telemetry events emitted by the Gate G-B Control Plane. It maps implementation files to event names and payloads to support analytics and regression testing.

## Event Catalog

| Event | Source | Payload Highlights |
| ---- | ------ | ------------------ |
| `intent_submitted` | `src/lib/intake/service.ts` | `{ input_chars, link_count }` |
| `mission_brief_loaded` | `src/app/(control-plane)/ControlPlaneWorkspace.tsx` | `{ kpi_count, safeguard_count }` |
| `mission_brief_pinned` | `src/app/(control-plane)/ControlPlaneWorkspace.tsx` | `{ kpi_count, safeguard_count }` |
| `brief_generated` | `src/lib/intake/service.ts` | `{ mission_id, source }` |
| `brief_item_modified` | `src/components/MissionIntake.tsx` | `{ field, regeneration_count }` |
| `toolkit_recommendation_viewed` | `src/app/api/toolkits/route.ts` | `{ selected_count, selected_slugs }` |
| `toolkit_selected` | `src/components/RecommendedToolkits.tsx` | `{ selected_count, selection_slugs }` |
| `inspection_preview_rendered` | `agent/agents/planner.py` | `{ selected_count, toolkits }` |
| `plan_validated` | `agent/agents/planner.py` | `{ plays_considered, readiness }` |
| `dry_run_started` / `dry_run_completed` | `src/components/StreamingStatusPanel.tsx` | `{ mission_id, tenant_id }` |
| `approval_required` / `approval_decision` | `src/components/ApprovalModal.tsx` | `{ decision, safeguard_count }` |

Refer to `new_docs/ux.md` for full UX context and to the code locations above for exact payload definitions.

## Implementation Notes
- All telemetry flows through `src/lib/telemetry/client.ts` (frontend) or `agent/services/telemetry.py` (backend).
- Payloads are redacted via `src/lib/telemetry/redaction.ts` before leaving the client.
- Tenants must be explicitly provided; no default tenant fallbacks remain.

## Testing
- `pnpm run test:ui -- --runInBand src/components/__tests__/RecommendedToolkits.test.tsx`
- `pnpm run test:ui -- --runInBand src/components/__tests__/MissionIntake.confidenceBadges.test.tsx`
- `pytest agent/tests/test_supabase_catalog.py`

## Follow-ups
- [ ] Automate telemetry snapshot validation using the events listed here.
- [ ] Review analytics dashboards after deployment to ensure event rename (`toolkit_selected`) is reflected.
