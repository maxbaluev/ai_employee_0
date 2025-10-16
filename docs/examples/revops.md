# Case Study: Revenue Operations — Dormant Account Reactivation

**Persona:** Riley Chen, Revenue Expansion Lead
**Industry:** Mid-Market B2B SaaS
**Mission Date:** October 2025
**Mission Duration:** 47 minutes (Define to Evidence)
**Outcome:** 23 personalized outreach sequences drafted, 19 approved for send

---

## Executive Summary

Riley manages a portfolio of 300+ mid-market accounts and noticed 87 high-value customers ($50K+ ARR) went dormant in Q2 2025. With Q4 approaching and a need to hit pipeline targets, Riley turned to the AI Employee Control Plane to design, validate, and execute a targeted reactivation campaign.

This case study demonstrates the **five-stage mission journey** in action:
1. **Define** — Capture intent and safeguards
2. **Prepare** — Validate toolkits and data coverage
3. **Plan & Approve** — Review ranked plays and risk assessment
4. **Execute & Observe** — Governed execution with validator oversight
5. **Reflect & Improve** — Feedback and library contribution

---

## Stage 1: Define

### Intent Submission

Riley opens the mission workspace and pastes the following into the generative intake banner:

```
Revive our top 20 dormant accounts from Q2 with personalized outreach.
Focus on accounts with >$50K prior ARR in manufacturing vertical.
Tone should be warm and consultative, not promotional.
Send between 9am-5pm recipient local time, Tuesday-Thursday only.
Avoid accounts on the do-not-contact list.
```

### Chip Generation

Within 3 seconds, the system generates these chips:

- **Objective:** "Reactivate dormant high-value manufacturing accounts"
  _Confidence: High_

- **Audience:** "Accounts >$50K ARR, manufacturing vertical, dormant Q2 2025"
  _Confidence: High_

- **KPIs:** "Reply rate ≥3%, meetings booked ≥5, pipeline contribution $1.2M"
  _Confidence: Medium_

- **Safeguards:**
  - "Warm, consultative tone (not promotional)"
  - "Send window: 9am-5pm recipient local time, Tue-Thu only"
  - "Exclude do-not-contact list"
  _Confidence: High_

- **Timeline:** "Complete outreach sequence within 5 business days"
  _Confidence: Medium_

### User Edits

Riley notices the KPI chip suggests $1.2M pipeline but wants to be more conservative. She clicks the chip, edits it to:

```
Reply rate ≥3%, meetings booked ≥5, pipeline contribution $800K
```

She regenerates the Timeline chip to say "Complete within 3 business days" to align with her Q4 planning cycle.

### Brief Locked

Riley clicks **Accept All** (`Ctrl+Enter`). The mission brief locks and stage 2 activates.

**Telemetry Emitted:**
- `intent_submitted` (token_count: 87, safeguard_presence: true)
- `brief_generated` (chips_generated: 5, avg_confidence: 0.84)
- `chip_regenerated` (chip_type: "kpi", reason: "user_edit")
- `chip_regenerated` (chip_type: "timeline", reason: "user_edit")
- `mission_brief_locked` (final_chip_count: 5, edits_made: 2)

---

## Stage 2: Prepare

### Pinned Brief Display

The accepted chips appear in a persistent **Mission Brief Card** at the top of the workspace. Riley can edit at any time by clicking "Edit Brief."

### Toolkit Recommendations

The system suggests:

1. **HubSpot** (no-auth, read-only)
   _Rationale: "Your team's CRM. 87 accounts match criteria. Ready for enrichment."_
   _Precedent: 12 similar missions in library_
   🟢 No-auth ready

2. **Gmail** (OAuth required, send)
   _Rationale: "Draft and send personalized emails. OAuth required for sending."_
   _Precedent: 18 missions used Gmail for outreach_
   🟡 OAuth required

3. **Slack** (OAuth optional, notify)
   _Rationale: "Notify #revenue-ops when sequences are ready for review."_
   _Precedent: 8 missions used Slack notifications_
   🟡 OAuth optional

Riley selects:
- ☑ **HubSpot** (no-auth, read-only for inspection)
- ☐ **Gmail** (defer OAuth until after approval)
- ☑ **Slack** (authorize via Connect Link)

### OAuth Flow (Prepare Stage)

After reviewing toolkit recommendations, Riley sees that Slack requires OAuth. Inspector presents a Connect Link approval modal via chat.

Riley reviews the request:
- **Toolkit:** Slack
- **Scopes:** `chat:write`, `channels:read`
- **Purpose:** Notify #revenue-ops when sequences are ready for review

Riley clicks **Approve** → Connect Link opens in side drawer → She authorizes → Inspector awaits `wait_for_connection()` → Token stored encrypted in `mission_connections` table with mission metadata.

**Gmail Note:** Riley opts to defer Gmail OAuth until she's reviewed the plan. Inspector notes this and will present Gmail authorization after plan approval if needed.

**Toolkit Status:**
- HubSpot: 🟢 Connected (no-auth, read-only)
- Gmail: 🟡 Deferred (will authorize after reviewing draft strategy)
- Slack: 🟢 Connected (OAuth complete via Inspector)

### Data Inspection

Riley clicks **Inspect Data Coverage**. The system runs read-only MCP probes:

- **HubSpot Preview:**
  - 87 contacts match filters
  - Sample fields: `company_name`, `industry`, `arr_value`, `last_touch_date`, `owner_email`
  - Redaction applied to PII fields
  - Coverage meter: **92%** (sufficient)

- **Safeguard Review:**
  - Do-not-contact list: 4 accounts excluded (83 remain)
  - Timezone data available: ✓
  - Send window validation: ✓

**Coverage Summary:**
- ✓ Objectives (100%)
- ✓ Contacts (HubSpot preview: 83 contacts)
- ✓ Safeguards (tone, timing, exclusions validated)
- ✓ Automation readiness (92%)

Riley proceeds to Stage 3.

**Telemetry Emitted:**
- `toolkit_recommended` (toolkit_id: "hubspot", precedent_count: 12)
- `toolkit_recommended` (toolkit_id: "gmail", precedent_count: 18)
- `toolkit_recommended` (toolkit_id: "slack", precedent_count: 8)
- `toolkit_selected` (toolkit_id: "hubspot", auth_status: "no_auth_ready")
- `toolkit_selected` (toolkit_id: "slack", auth_status: "oauth_complete")
- `data_preview_generated` (source: "hubspot", records_matched: 83, coverage: 0.92)
- `safeguard_reviewed` (safeguard_type: "do_not_contact", exclusions_applied: 4)

---

## Stage 3: Plan & Approve

### Planner Receives Established Connections

Planner agent receives:
- **Established connections:** HubSpot (no-auth, read-only), Slack (OAuth complete)
- **Deferred:** Gmail (awaiting approval for send scope)
- **Data investigation insights:** 83 contacts matched, 92% coverage, 4 excluded via do-not-contact

### Planner Streaming

The Planner agent assembles mission plays based on tool usage patterns and data investigation, annotating sequencing, resource requirements, and undo affordances for each option. Riley sees:

**Play 1: "Targeted Q2 Win-Back Campaign"**
_Confidence: 0.87 · Library Match: 5 similar missions_

**Rationale:**
"Leverages HubSpot enrichment (already connected) to generate personalized email drafts. Emphasizes warm, consultative tone from safeguards. Schedules review before send. Requires Gmail OAuth for final send step—Inspector will present approval if you proceed."

**Steps:**
1. Enrich 83 contacts with recent activity, ARR changes, industry trends (HubSpot, no-auth)
2. Generate personalized email drafts (templated with placeholders) using data investigation insights
3. Apply tone safeguards (validator auto-fix enabled)
4. Package for review and approval
5. [Conditional] Send via Gmail—Inspector will request OAuth if approved

**Undo Plan:**
"Drafts discarded from workspace. No external mutations until Gmail OAuth + final send approval."

**Safeguards Enforced:**
- ✓ Warm, consultative tone (from Define stage)
- ✓ Send window: 9am-5pm local time, Tue-Thu (from Define stage)
- ✓ Do-not-contact exclusions (validated during Prepare)
- ✓ Validator monitoring enabled

**Tool Usage Patterns Detected:**
- HubSpot: Read-only enrichment (83 contact records)
- Gmail: Deferred send (pending approval)
- Slack: Notification upon completion

---

**Play 2: "Multi-Touch Sequence with LinkedIn Outreach"**
_Confidence: 0.72 · Library Match: 2 similar missions_

**Rationale:**
"Combines email + LinkedIn connection requests. Higher touch effort but may yield better engagement."

Riley dismisses Play 2 (prefers email-only for this campaign).

---

**Play 3: "Automated Drip Campaign via HubSpot Workflows"**
_Confidence: 0.65 · Library Match: 1 mission_

**Rationale:**
"Uses HubSpot sequences (requires Enterprise tier). Lower personalization."

Riley dismisses Play 3 (wants manual approval before sends).

### Play Selection

Riley clicks **Select Play 1**. The system displays a risk matrix:

| Dimension        | Assessment | Notes                                    |
| ---------------- | ---------- | ---------------------------------------- |
| **Impact**       | Medium     | 83 accounts, $800K pipeline potential    |
| **Reversibility**| High       | Drafts only; undo available pre-send     |
| **Safeguards**   | Complete   | Tone, timing, exclusions enforced        |
| **Precedent**    | Strong     | 5 similar missions, 4.2/5 avg rating     |

### Approval Modal

Riley clicks **Request Approval**. The modal summarizes:

```
Mission: Dormant Account Reactivation
Play: Targeted Q2 Win-Back Campaign
Expected Outcome: 83 personalized email drafts
Risk Level: Medium-Low
Undo Plan: Discard drafts (no external mutations)
Required OAuth: Gmail (send scope) — Inspector will request authorization before execution
```

Riley clicks **Approve Play**.

### Gmail OAuth Completion (Inspector Returns)

Since the approved play requires Gmail send capabilities, Inspector presents one final Connect Link request:

**Toolkit:** Gmail
**Scopes:** `gmail.send`, `gmail.compose`
**Purpose:** Send personalized outreach emails (83 drafts)

Riley clicks **Approve** → Connect Link opens → She authorizes → Inspector logs granted scopes → Planner confirms all required connections are now established.

**Final Toolkit Status:**
- HubSpot: 🟢 Connected
- Gmail: 🟢 Connected (OAuth complete)
- Slack: 🟢 Connected

**Telemetry Emitted:**
- `planner_candidate_generated` (play_id: "play_1", confidence: 0.87, precedent_count: 5)
- `planner_candidate_generated` (play_id: "play_2", confidence: 0.72)
- `planner_candidate_generated` (play_id: "play_3", confidence: 0.65)
- `plan_ranked` (selected_play: "play_1", rationale_shown: true)
- `plan_approved` (play_id: "play_1", reviewer_id: "riley_chen", risk_level: "medium_low")
- `composio_auth_flow` (toolkit: "gmail", status: "approved", scopes: ["gmail.send", "gmail.compose"])

---

## Stage 4: Execute & Observe

### Streaming Execution Panel

Riley clicks **Start Execution**. The streaming status panel shows:

```
[Step 1/4] Enriching contacts from HubSpot... ✓ (83 contacts enriched)
[Step 2/4] Generating personalized email drafts... ⏳
  ├─ Draft 1/83: Acme Manufacturing (VP Ops: Sarah Torres) ✓
  ├─ Draft 2/83: BuildCorp Industries (CTO: James Kim) ✓
  └─ ...
[Step 3/4] Applying tone safeguards (Validator active)...
  ├─ Auto-fix: Softened 12 email openers for warmth
  ├─ Auto-fix: Adjusted 3 CTAs to be consultative
  └─ No violations detected
[Step 4/4] Packaging evidence bundle...
```

### Validator Oversight

The Validator agent monitors each draft generation:

- **Auto-fix Applied:**
  - 12 emails: Changed "We'd love to discuss..." → "I'd enjoy catching up about..."
  - 3 emails: Removed promotional language ("limited-time offer" → "happy to explore")

- **Escalations:** None (all safeguards met)

### Evidence Gallery Population

As execution progresses, artifacts appear:

1. **Contact List** (CSV, 83 records)
   _Hash: `sha256-ea5f...` · Redacted: PII fields masked_

2. **Email Drafts** (Markdown bundle, 83 drafts)
   _Hash: `sha256-47ac...` · Preview: Sample drafts displayed_

3. **ROI Estimate** (PDF report)
   _Hash: `sha256-92bd...` · Summary: 3-5% reply rate, 5-7 meetings, $800K pipeline_

4. **Validator Report** (JSON)
   _Hash: `sha256-1c3e...` · Auto-fixes: 15 applied, Violations: 0_

### Undo Bar

Riley sees an undo countdown:

```
Undo available for 15 minutes after execution.
Impact: 83 email drafts generated (no external sends yet).
Rollback: Discard drafts from workspace.
```

Riley does not trigger undo. Execution completes in **8 minutes, 32 seconds**.

**Telemetry Emitted:**
- `execution_started` (play_id: "play_1", step_count: 4)
- `execution_step_completed` (step: 1, duration_ms: 12400, records_processed: 83)
- `execution_step_completed` (step: 2, duration_ms: 312000, drafts_generated: 83)
- `validator_alert_raised` (alert_type: "auto_fix", count: 15, severity: "low")
- `execution_step_completed` (step: 3, duration_ms: 8200, auto_fixes_applied: 15)
- `execution_step_completed` (step: 4, duration_ms: 4600, artifacts_generated: 4)
- `evidence_bundle_generated` (mission_id: "rev-2025-q4", artifact_count: 4, total_hash: "sha256-9f8a...")

---

## Stage 5: Reflect & Improve

### Feedback Drawer

Riley opens the feedback drawer and provides:

**Quick Reaction:** ⭐⭐⭐⭐⭐ (5/5 stars)

**Effort Saved:** "3 hours of manual drafting and personalization"

**Qualitative Feedback:**
```
Love the tone safeguard auto-fix! The drafts feel warm and consultative.
Validator caught promotional language I would have missed.
HubSpot enrichment was perfect—no manual data pulls needed.
```

**Suggested Improvement:**
```
Would love to see LinkedIn profile links auto-added to drafts for context.
```

### Library Contribution

The system prompts:

```
This play performed well and matches 5 similar missions.
Would you like to contribute it to the team library?
```

Riley clicks **Pin to Library** and adds tags:
- `revenue-ops`
- `win-back`
- `manufacturing`
- `q4-2025`

The play is now available to teammates with similar objectives.

### Follow-Up Checklist

Riley completes the post-mission checklist:

- [x] Review all 83 drafts (spot-checked 10, approved 83)
- [x] Authorize Gmail OAuth for sending
- [x] Schedule sends for Tuesday-Thursday 9am-5pm local time
- [x] Notify #revenue-ops Slack channel
- [x] Set reminder to track reply rates after 7 days

**Telemetry Emitted:**
- `feedback_submitted` (rating: 5, effort_saved_hours: 3, sentiment: "positive")
- `library_contribution` (play_id: "play_1", tags: ["revenue-ops", "win-back", "manufacturing", "q4-2025"])
- `mission_retrospective_logged` (follow_up_tasks: 5, owner: "riley_chen")

---

## Outcomes & Metrics

### Mission Metrics

| Metric | Value |
|--------|-------|
| **Total Time** | 47 minutes (Define → Evidence) |
| **Contacts Processed** | 83 accounts |
| **Drafts Generated** | 83 personalized emails |
| **Safeguard Auto-Fixes** | 15 applied |
| **Validator Violations** | 0 |
| **Effort Saved** | ~3 hours manual work |
| **Library Reuse** | Play contributed for team reuse |

### Business Impact (7-Day Follow-Up)

| Metric | Projected | Actual |
|--------|-----------|--------|
| **Emails Sent** | 83 | 79 (4 opted out) |
| **Reply Rate** | 3-5% | 6.3% (5 replies) |
| **Meetings Booked** | 5-7 | 6 meetings |
| **Pipeline Contribution** | $800K | $920K (6 opportunities) |
| **Customer Satisfaction** | N/A | 4.8/5 (post-meeting survey) |

---

## Key Takeaways

### What Worked Well

1. **Generative Intake:** Riley's freeform intent was parsed into actionable chips with high confidence.
2. **No-Auth Inspection:** HubSpot data preview provided coverage validation without requiring credentials upfront.
3. **Validator Auto-Fix:** 15 tone safeguard adjustments saved Riley manual editing time.
4. **Library Precedent:** Planner leveraged 5 similar missions to rank plays confidently.
5. **Undo Plan Clarity:** Riley felt safe knowing drafts could be discarded without external impact.

### Opportunities for Improvement

1. **LinkedIn Integration:** Riley requested profile link enrichment for future missions.
2. **KPI Calibration:** Initial $1.2M pipeline projection was optimistic; Riley adjusted to $800K (actual: $920K).
3. **OAuth Deferral:** Deferring Gmail OAuth until approval was helpful but added a step at execution.

### Safeguards in Action

- **Do-Not-Contact Exclusions:** 4 accounts automatically filtered during data inspection.
- **Tone Enforcement:** Validator caught and fixed 15 promotional phrases.
- **Send Window Validation:** All sends scheduled within 9am-5pm local time, Tue-Thu only.
- **Audit Trail:** Complete telemetry and evidence bundle generated for compliance review.

---

## References

- **[User Experience Blueprint](../03_user_experience.md)** — Five-stage journey patterns
- **[System Overview](../02_system_overview.md)** — Architecture and agent roles
- **[Data Intelligence](../06_data_intelligence.md)** — Telemetry event catalog
- **[Capability Roadmap](../05_capability_roadmap.md)** — Milestone readiness evidence

---

**Case Study Author:** AI Employee Documentation Team
**Last Updated:** October 2025
**Next Review:** January 2026
**Feedback:** Submit to `docs/readiness/feedback/` or tag `@ai-agent-team`
