# Toolkit Selection Persistence Cleanup

**Date:** 2025-10-13  
**Focus:** Gate G-B alignment – Toolkit selection persistence

---

## Summary
- Frontend, backend, and documentation now consistently store toolkit choices in `toolkit_selections` via `/api/toolkits/selections`.
- Planner inspection preview reads from `toolkit_selections`, eliminating the legacy `mission_safeguards` dependency.
- `GATE_GA_DEFAULT_TENANT_ID` fallback removed from toolkit catalog endpoint; requests must provide tenant context explicitly.

---

## Files Touched
- `agent/services/supabase.py` – added `fetch_toolkit_selections` helper.
- `agent/agents/planner.py` – inspection preview pipeline now consumes toolkit selections.
- `agent/tests/test_supabase_catalog.py`, `agent/tests/test_coordinator_inspection_gate.py`, `agent/evals/control_plane/__init__.py` – updated stubs/tests.
- `src/app/api/toolkits/route.ts` – tenant resolution tightened.
- `new_docs/{architecture,workflow,ux,todo}.md` – updated Gate G-B contract.
- `docs/readiness/cleanup/2025-10-13-control-plane-cleanup.md` – retained for intake/safeguard normalization notes.

---

## Validation
- `pnpm run test:ui -- --runInBand src/lib/safeguards/__tests__/normalization.test.ts src/components/__tests__/MissionIntake.confidenceBadges.test.tsx src/components/__tests__/MissionIntake.fallbackRemoval.test.tsx`
- `pytest agent/tests/test_supabase_catalog.py`

---

## Follow Ups
- (Optional) Add CHECK constraint restricting `mission_safeguards.hint_type` to non-toolkit values to prevent regression.
- Monitor production telemetry for `inspection_preview_rendered` to confirm new payload shape matches expectations.
