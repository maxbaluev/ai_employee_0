# Gate G-B Retrospective — October 2025

**Gate Window:** 2025-09-22 → 2025-10-13  
**Facilitator:** Control Plane Runtime Crew  
**Attendees:** Product, Runtime Ops, Governance Sentinel, Telemetry, Agent Platform

## Timeline Highlights
- **Sep 22** — Kick-off; backlog groomed into `new_docs/todo.md` with eight-stage readiness map.
- **Sep 30** — CopilotKit streaming heartbeat hardened; Planner eval suite green on smoke and G-B ranking cases.
- **Oct 04** — Connect Link OAuth CTA shipped end-to-end with Supabase persistence and telemetry audit hooks.
- **Oct 08** — Evidence service hash verification script bundled into CI dry run; readiness docs baselined.
- **Oct 12** — Gate rehearsal: eight-stage mission walkthrough recorded, feedback drawer telemetry verified.
- **Oct 13** — Final readiness sign-off contingent on Redis limiter store and telemetry audit secrets.

## What Worked Well
- **Integrated Tooling** — Mise task runners kept Node + Python workflows consistent across agents and UI contributors.
- **Telemetry Coverage** — `gate_g_b_telemetry_reference.md` and the audit script gave teams a single checklist; no missing events were found in dry run.
- **Evidence Integrity** — `scripts/verify_artifact_hashes.py` and the undo trace log provided quick assurance during reviews.
- **Streaming UX** — Heartbeat resiliency improvements cut reconnect latency to < 3s during simulated SSE failures.

## What Was Painful
- **Redis Limiter Gaps** — Memory backend hid limiter contention; Redis configuration still needs production hardening.
- **Supabase Type Regeneration** — Lack of linked project credentials blocked regeneration of `mission_regeneration_limits` typings.
- **Telemetry Secrets in CI** — The telemetry audit workflow could not run in CI because `SUPABASE_URL`/`SERVICE_ROLE_KEY` were absent.
- **Manual Evidence Herding** — Without a central index reviewers had to cross-reference multiple documents (fixed by this archive).

## Experiments to Keep
- Streaming heartbeat Playwright suite caught regressions early; keep it in the mandatory pre-merge pack.
- Undo countdown UX tested well with governance; retain the persistent banner pattern for Gate G-C.

## Action Items
- **Runtime Ops** — Provision managed Redis and enable the limiter store toggle before production cutover.
- **Platform Integrations** — Supply Supabase credentials so `supabase gen types ...` can run in CI and remove manual casts.
- **Telemetry Crew** — Wire `scripts/audit_telemetry_events.py --gate G-B` into CI once secrets land; produce failing examples for training.
- **Governance** — Schedule quarterly evidence bundle spot-check using `docs/readiness/evidence_index_G-B.md`.

## Acknowledgements
- **Streaming Resilience Team** for delivering the heartbeat reconnection logic ahead of schedule.
- **Evidence Working Group** for pairing on hash verification and undo trace documentation.
- **Program Management** for maintaining the risk register and status beacon throughout the gate push.

