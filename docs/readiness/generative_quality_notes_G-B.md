# Gate G-B Generative Quality Notes

_Last updated: October 10, 2025_

This log aggregates qualitative observations gathered while validating the
Gate G-B dry-run loop. It complements the quantitative metrics in
`docs/readiness/generative_quality_report_G-B.md` and the data export produced
by `scripts/analyze_edit_rates.py`.

## Session Highlights

- **Persona coverage**: Simulated marketing, support, and finance missions all
  generated guardrail-aware drafts with confidence scores between 0.58–0.72.
- **Tone adjustments**: Validator prompted soft-tone suggestions twice; in both
  cases the reviewer accepted the auto-fix path and the regenerated artifact
  reflected the change.
- **Quiet-hour hints**: One finance scenario required a quiet-hour override.
  Reviewer documented the exception and telemetry registered
  `safeguard_hint_rejected` with justification.

## Participant Feedback (Pilot Interviews)

| Role | Quote | Follow-Up |
| ---- | ----- | --------- |
| Revenue lead | “Streaming updates make it clear why the agent is pausing.” | Explore surfacing ETA badges for long planner phases. |
| Support lead | “Undo CTA is obvious, but I’d like a confidence badge next to the draft reply.” | Investigate inline confidence pill on artifact cards. |
| Governance | “Need a single export combining approvals + artifacts.” | Blocked on Supabase staging data; tracked in status beacon blockers. |

## Action Items

1. Add confidence badge to artifact preview component (`src/components/ArtifactCard.tsx`).
2. Extend `scripts/analyze_edit_rates.py` to segment edits by safeguard hint type.
3. Partner with data team to populate Supabase staging project so acceptance
   metrics move from simulated data to production telemetry.

