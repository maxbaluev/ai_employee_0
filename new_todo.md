# AI Employee Control Plane — Comprehensive Implementation Todo (Gate G-B)

**Date:** 2025-10-12
**Version:** 1.0
**Scope:** Full Gate G-B implementation requirements based on documentation in `new_docs/` and partner library documentation in `libs_docs/`

---

## Executive Summary

This document enumerates granular, file-scoped todos required to reach full Gate G-B implementation of the AI Employee Control Plane. All requirements are cross-referenced against:

- Architecture documentation (`new_docs/architecture.md`)
- Product requirements (`new_docs/prd.md`)
- UX blueprint (`new_docs/ux.md`)
- Workflow specification (`new_docs/workflow.md`)
- Implementation roadmap (`new_docs/todo.md`)
- Safeguard integration guide (`new_docs/safeguard_integration.md`)
- Partner library documentation (`libs_docs/adk`, `libs_docs/composio`, `libs_docs/copilotkit`, `libs_docs/supabase`)

The current codebase has significant Gate G-B foundation in place. This document identifies remaining work to achieve full compliance with the eight-stage mission flow, comprehensive telemetry, managed authentication, and all acceptance criteria.

---

## Table of Contents

1. [Mission Status Summary](#mission-status-summary)
2. [Frontend Implementation](#frontend-implementation)
3. [Backend Agents](#backend-agents)
4. [API & Database](#api--database)
5. [Telemetry & Analytics](#telemetry--analytics)
6. [Testing & Quality Assurance](#testing--quality-assurance)
7. [Documentation & Evidence](#documentation--evidence)
8. [Appendix A: Evidence Artifacts](#appendix-a-evidence-artifacts)
9. [Appendix B: Gate Promotion Criteria](#appendix-b-gate-promotion-criteria)
10. [Open Questions & Assumptions](#open-questions--assumptions)

---

## Mission Status Summary

### Eight-Stage Mission Flow Status

| Stage | Name | Priority | Status | Blockers |
|-------|------|----------|--------|----------|
| 1 | **Intake** | P0 | ✅ Complete | None |
| 2 | **Mission Brief** | P0 | ✅ Complete | None |
| 3 | **Toolkits & Connect** | P0 | ⚠️ Partial | Connect Link integration incomplete |
| 4 | **Data Inspect** | P1 | ⚠️ Partial | Coverage meter implementation pending |
| 5 | **Plan** | P0 | ✅ Complete | None |
| 6 | **Dry-Run** | P0 | ✅ Complete | None |
| 7 | **Evidence** | P1 | ⚠️ Partial | Undo button UI incomplete |
| 8 | **Feedback** | P1 | ✅ Complete | None |

### Gate G-B Readiness: ~75%

**Completed:**
- Eight-stage state machine in ControlPlaneWorkspace
- Generative intake with chip editing and regeneration
- Streaming status panel with heartbeat monitoring
- Planner insight rail with rationale streaming
- Safeguard drawer with accept/edit/pin actions
- Approval modal with safeguard chips
- Mission feedback drawer with ratings
- Database schema with all Gate G-B tables
- Telemetry events for all major user actions
- ADK agents (Coordinator, Planner, Executor, Validator, Evidence)
- Composio toolkit discovery and OAuth foundations

**In Progress:**
- Recommended tool strip with multi-select (component exists, integration partial)
- Coverage meter with MCP inspection preview (component exists, validation gating incomplete)
- Artifact gallery with undo bar (component exists, undo execution incomplete)
- Connect Link authentication flow (API routes exist, UI integration pending)

**Pending:**
- Full end-to-end undo execution via Evidence service
- MCP inspection draft mode validation
- Composio Connect Link UI integration in toolkit selection
- Comprehensive test coverage for eight-stage flow
- Evidence artifacts for Gate G-B promotion

---

## Frontend Implementation

### [ ] Stage 1: Generative Intake — Remove Remaining Fallback Logic

**Files:**
- `src/components/MissionIntake.tsx`
- `src/app/api/intake/generate/route.ts`

**Reference:** `new_docs/architecture.md` §3.1, `new_docs/ux.md` §5.1, `new_docs/todo.md` Gate G-B §A

**Tasks:**
1. Audit `MissionIntake.tsx` for any remaining "manual input" or "skip generation" fallback paths
2. Ensure all UI paths enforce 100% generative intake (no bypass to manual chip creation)
3. Add confidence badges to all chip rows (High/Medium/Low based on confidence scores)
4. Implement aria-live announcements for confidence levels
5. Ensure 3-regeneration limit is enforced client-side with clear messaging after limit reached
6. Add token count indicator in intake banner with live updates
7. Display privacy notice ("No data stored until you accept") prominently

**Acceptance:**
- No code path allows bypassing chip generation
- Confidence badges visible on all chips with correct color coding
- Screen reader announces confidence levels
- Token counter updates as user types
- Privacy notice passes accessibility audit

**Dependencies:**
- `src/lib/intake/service.ts` (confidence scoring)
- `src/lib/intake/regenerationLimiter.ts` (limit enforcement)

**Priority:** P1 (refinement)

---

### [ ] Stage 3: Recommended Tool Strip — Complete Multi-Select Integration

**Files:**
- `src/components/RecommendedToolStrip.tsx`
- `src/components/RecommendedToolkits.tsx`
- `src/app/api/toolkits/route.ts`
- `src/app/api/toolkits/selections/route.ts`
- `src/app/api/composio/connect/route.ts`

**Reference:** `new_docs/architecture.md` §3.8, `new_docs/ux.md` §5.2, `new_docs/workflow.md` §4, `libs_docs/composio/llms.txt` §3-4

**Tasks:**
1. Wire `RecommendedToolStrip` to display toolkit cards from Composio `tools.get(search=..., limit=8)`
2. Display badges for each toolkit:
   - "No credentials needed" for `no_auth` toolkits
   - "Requires OAuth" for OAuth toolkits with scope details
   - Impact estimates (e.g., "High", "Medium", "Low")
   - Precedent missions count (e.g., "Used in 12 missions")
3. Implement multi-select behavior (checkbox or toggle for each card)
4. Persist selections to `toolkit_selections` table via `POST /api/toolkits/selections`
5. Integrate Connect Link flow:
   - Display "Connect" button for OAuth toolkits when selected
   - Call `POST /api/composio/connect` to generate `redirectUrl`
   - Handle OAuth callback and store `connectedAccountId` in `oauth_tokens` table
   - Display connection status badge after successful auth
6. Trigger MCP inspection preview after toolkit selection (calls `POST /api/inspect/preview`)
7. Display inspection summary inline (e.g., "Found 23 contacts, recommended segmentation ready")
8. Emit telemetry events:
   - `toolkit_recommendation_viewed` (on cards rendered)
   - `toolkit_selected` (on selection toggle)
   - `toolkit_deselected` (on deselection)
   - `oauth_initiated` (on Connect button click)
   - `oauth_completed` (on successful connection)

**Acceptance:**
- Toolkit cards render with all metadata badges
- Multi-select works via keyboard (Space to toggle, Arrow keys to navigate)
- Selections persist to database and survive page reload
- Connect Link opens in new window/popup and completes OAuth handshake
- Connection status badge updates after successful auth
- Inspection preview displays inline with coverage summary
- All telemetry events fire with correct payloads

**Dependencies:**
- Composio SDK `tools.get` with search and limit parameters
- Composio Connect Link API (`toolkits.authorize`, `waitForConnection`)
- `supabase/migrations/0001_init.sql` (toolkit_selections, oauth_tokens tables)
- `src/lib/telemetry/client.ts`

**Priority:** P0 (blocker)

---

### [ ] Stage 4: Coverage Meter — Implement Validation Gating

**Files:**
- `src/components/CoverageMeter.tsx`
- `src/app/api/inspect/preview/route.ts`
- `agent/agents/validator.py`

**Reference:** `new_docs/architecture.md` §3.4, `new_docs/ux.md` §4.2, `new_docs/workflow.md` §4.1

**Tasks:**
1. Implement `CoverageMeter` component displaying:
   - Readiness percentage (0-100%) calculated from inspection findings
   - Gap highlights (list of missing scopes, stale data, authorization issues)
   - Color-coded status (red <50%, amber 50-84%, green ≥85%)
2. Fetch inspection findings from `inspection_findings` table
3. Display inspection previews inline:
   - Sample data summaries (e.g., "Fetched 5 sample contacts")
   - Coverage metrics (e.g., "87% data coverage, 13% missing fields")
   - Freshness indicators (e.g., "Data last updated 2 hours ago")
4. Implement validation gate:
   - Disable "Proceed to Planning" button if coverage <85%
   - Display clear messaging about gaps and how to resolve
   - Allow override with reviewer approval (logged to `approvals`)
5. Wire validator agent to consume inspection results:
   - Validator reads from `inspection_findings` table
   - Cross-checks against accepted safeguards in `mission_safeguards`
   - Returns `auto_fix`, `ask_reviewer`, or `retry_later` outcomes
6. Emit telemetry events:
   - `inspection_preview_rendered` (on preview display)
   - `plan_validated` (on successful ≥85% coverage)
   - `plan_validation_failed` (on coverage <85%)

**Acceptance:**
- Coverage meter displays correct percentage based on inspection findings
- Gap highlights are actionable and specific
- UI prevents progression to Planning stage if coverage <85%
- Validator agent correctly processes inspection results
- All telemetry events captured in `mission_events` table

**Dependencies:**
- `POST /api/inspect/preview` (MCP draft calls)
- `agent/agents/validator.py` (validation logic)
- `supabase/migrations/0001_init.sql` (inspection_findings table)

**Priority:** P1

---

### [ ] Stage 7: Artifact Gallery — Complete Undo Flow

**Files:**
- `src/components/ArtifactGallery.tsx`
- `src/components/UndoButton.tsx` (create if missing)
- `src/app/api/undo/route.ts`
- `agent/services/evidence_service.py`

**Reference:** `new_docs/architecture.md` §3.6, `new_docs/ux.md` §5.6-§5.7, `new_docs/workflow.md` §8

**Tasks:**
1. Build `UndoButton` component with:
   - Time-bound visibility (24 hours configurable)
   - Confirmation modal on click
   - Clear undo plan description (from `tool_calls.undo_plan_json`)
   - Keyboard shortcut (Ctrl+Z context-aware)
   - ARIA announcements for screen readers
2. Wire `POST /api/undo` endpoint to Evidence service:
   - Accept `{ tool_call_id, reason }` payload
   - Call `agent/services/evidence_service.py:execute_undo(tool_call_id)`
   - Record outcome to `safeguard_events` (success/failure)
   - Return updated status and any errors
3. Implement `execute_undo` in Evidence service:
   - Retrieve `undo_plan_json` from `tool_calls` table
   - Execute undo steps (may call Composio reversal tools or manual follow-up)
   - Hash undo payload for audit trail
   - Update `tool_calls.undo_status` field (currently using undo_status annotation)
   - Emit telemetry: `undo_requested`, `undo_completed`, `undo_failed`
4. Display undo status in ArtifactGallery:
   - Show "Undo available" badge if <24 hours
   - Show "Undo unavailable (expired)" if >24 hours
   - Show "Undone" status if already executed
   - Show "Undo failed" with error details if execution failed
5. Add undo plan narration to ApprovalModal:
   - Display undo plan prominently in approval modal
   - Ensure screen reader announces plan on modal open
   - Include undo confidence score if available

**Acceptance:**
- Undo button visible for 24 hours after tool call execution
- Confirmation modal displays clear undo plan description
- API successfully executes undo via Evidence service
- Undo status updates correctly in UI after execution
- All telemetry events captured
- Undo plan appears in approval modal with accessibility support
- Hash verification ensures undo integrity

**Dependencies:**
- `agent/services/evidence_service.py`
- `supabase/migrations/0001_init.sql` (tool_calls.undo_plan_json)
- `src/lib/telemetry/client.ts`

**Priority:** P1

---

### [ ] General Frontend: Accessibility & Keyboard Navigation

**Files:**
- All components in `src/components/`
- `src/app/(control-plane)/ControlPlaneWorkspace.tsx`

**Reference:** `new_docs/ux.md` §9

**Tasks:**
1. Complete WCAG 2.1 AA compliance audit:
   - All icons and images have alt text or ARIA labels
   - 4.5:1 contrast ratio for text, 3:1 for UI components
   - Semantic HTML with correct landmark regions
   - Focus indicators visible (2px outline, high contrast)
   - Skip links present ("Skip to main content")
2. Implement global keyboard shortcuts per UX blueprint §9.2:
   - `N` — New Mission
   - `D` — Dashboard
   - `L` — Library
   - `G` then `A` — Analytics
   - `G` then `G` — Governance
   - `Ctrl+Z` — Undo (context-aware)
   - `Ctrl+P` — Pause execution
   - `Ctrl+X` — Cancel mission
   - `?` — Show keyboard shortcuts reference
3. Ensure all components support keyboard navigation:
   - Tab to focus elements
   - Enter to activate
   - Space to toggle checkboxes/radios
   - Arrow keys to navigate lists/cards
   - Esc to close modals
4. Add live regions for screen readers:
   - Agent streaming status (`role="status"`, `aria-live="polite"`)
   - Approval interrupts (`role="alert"`, `aria-live="assertive"`)
   - Undo confirmations (`role="status"`, `aria-live="polite"`)
5. Test with NVDA, JAWS, and VoiceOver
6. Run automated axe-core accessibility tests in CI

**Acceptance:**
- Automated axe-core tests pass
- Manual screen reader testing confirms all critical paths are accessible
- Keyboard navigation works without mouse for all workflows
- All color contrast ratios meet WCAG 2.1 AA standards
- Accessibility audit report generated in `docs/readiness/accessibility_audit_G-E.pdf`

**Dependencies:**
- None (self-contained)

**Priority:** P1 (Gate G-E requirement, start early)

---

## Backend Agents

### [ ] Coordinator Agent — Ensure Robust Error Handling

**Files:**
- `agent/agents/coordinator.py`
- `agent/agents/execution_loop.py`

**Reference:** `new_docs/architecture.md` §3.3, `new_docs/workflow.md` §13, `libs_docs/adk/llms-full.txt`

**Tasks:**
1. Ensure `coordinator.py` implements full error handling for:
   - Planner discovery failures (no catalog results)
   - Composio rate limits (429 responses)
   - Validator retry exhaustion (max 3 failures)
   - Supabase write failures (with exponential backoff)
   - CopilotKit disconnect (>30 seconds presence lost)
2. Implement graceful degradation:
   - Emit `planner_no_catalog` warning if Composio returns zero matches
   - Fallback to library-only suggestions
   - Queue final status message for user on disconnect
3. Ensure `copilotkit_exit` always fires:
   - Success paths
   - Error paths (with error details)
   - Timeout paths
4. Log mission flags for persistent issues:
   - `mission_flags.rate_limited` (Composio 429s)
   - `mission_flags.validator_dead_end` (retry exhaustion)
   - `mission_flags.storage_failure` (Supabase errors)
5. Emit comprehensive telemetry:
   - `coordinator_error` (with error type, stage, retry count)
   - `coordinator_fallback` (with fallback strategy)
   - `coordinator_exit` (with final status)

**Acceptance:**
- All error paths tested with integration tests
- `copilotkit_exit` confirmed to fire in all scenarios
- Mission flags correctly set in error cases
- Telemetry events captured for all error paths
- Error messages surfaced to UI with actionable guidance

**Dependencies:**
- `agent/services/copilotkit.py` (emit_message, exit helpers)
- `agent/services/telemetry.py`
- `supabase/migrations/0001_init.sql` (mission_events, safeguard_events)

**Priority:** P0

---

### [ ] Planner Agent — Optimize Library & Composio Discovery

**Files:**
- `agent/agents/planner.py`
- `agent/tools/composio_client.py`

**Reference:** `new_docs/architecture.md` §3.2, `new_docs/workflow.md` §4, `libs_docs/composio/llms.txt` §3

**Tasks:**
1. Implement hybrid ranking pipeline:
   - Query Supabase pgvector (`match_library_entries` function) for similar plays
   - Query Composio `tools.get(search=objective, limit=5)` with persona filters
   - Combine results with weighted scoring (library similarity * 0.6 + Composio importance * 0.4)
2. Enforce Composio best practices:
   - Never mix `search` with explicit `tools` arrays
   - Never use `scopes` across multiple toolkits
   - Always set `limit` (default 5 for recommendations)
   - Prefer `no_auth` toolkits in dry-run mode
3. Persist planner telemetry to `planner_runs` table:
   - `latency_ms` (end-to-end planner execution time)
   - `candidate_count` (number of plays generated)
   - `embedding_similarity_avg` (average similarity score from library)
   - `primary_toolkits` (array of toolkit names)
   - `mode` (dry_run or governed)
4. Generate `reason_markdown` for each candidate play:
   - Explain library match (similarity score, precedent missions)
   - Explain Composio recommendation (importance score, auth requirements)
   - Explain expected impact and undo confidence
   - Sanitize markdown before persisting to prevent XSS
5. Validate planner performance:
   - p95 latency ≤2.5 seconds
   - Top-3 similarity ≥0.62 (cosine similarity threshold)
   - At least 1 `no_auth` toolkit in Top-3 for dry-run mode

**Acceptance:**
- Hybrid ranking combines library + Composio results correctly
- Planner telemetry persisted to `planner_runs` table
- `reason_markdown` generated and sanitized for all candidates
- Performance metrics meet targets (latency, similarity)
- Integration tests validate ranking logic

**Dependencies:**
- `agent/tools/composio_client.py` (Composio SDK wrapper)
- `agent/services/supabase.py` (vector search)
- `supabase/migrations/0001_init.sql` (planner_runs, match_library_entries function)

**Priority:** P0

---

### [ ] Validator Agent — Implement Safeguard Enforcement

**Files:**
- `agent/agents/validator.py`

**Reference:** `new_docs/architecture.md` §3.3, `new_docs/workflow.md` §7

**Tasks:**
1. Implement validator logic to read accepted safeguards from:
   - `mission_safeguards` table (where `status='accepted'`)
   - Session state `ctx.session.state['safeguards']`
2. Evaluate proposed tool calls against safeguards:
   - **Tone checks**: Analyze message content for tone violations (e.g., too aggressive, unprofessional)
   - **Quiet hours**: Compare execution time against quiet window hints (e.g., 8pm-7am local)
   - **Budget caps**: Check estimated cost against budget limits
   - **Escalation contacts**: Ensure high-risk actions flag for escalation
3. Return structured outcomes:
   - `auto_fix`: Validator can auto-correct (e.g., soften tone, reschedule outside quiet hours)
   - `ask_reviewer`: Requires human approval (surface via CopilotKit interrupt)
   - `retry_later`: Timing issue, schedule for later (e.g., during business hours)
4. Log all validator decisions to `safeguard_events`:
   - Event type: `hint_applied`, `hint_declined`, `violation_detected`, `auto_fix`, `send_anyway`
   - Details: Safeguard type, proposed fix, confidence
   - Resolution timestamp
5. Implement retry limit:
   - Max 3 retries per tool call
   - After 3 failures, escalate to reviewer with `validator_dead_end` flag
6. Emit telemetry:
   - `validator_check_started`
   - `validator_auto_fix_applied`
   - `validator_reviewer_required`
   - `validator_retry_scheduled`

**Acceptance:**
- Validator reads safeguards correctly from database and session state
- All safeguard types enforced (tone, quiet hours, budget, escalation)
- Outcomes correctly categorized (auto_fix, ask_reviewer, retry_later)
- Safeguard events logged with full details
- Retry limit enforced with escalation after 3 failures
- Telemetry captured for all validator decisions

**Dependencies:**
- `agent/services/supabase.py` (read mission_safeguards)
- `supabase/migrations/0001_init.sql` (safeguard_events table)
- `agent/services/telemetry.py`

**Priority:** P0

---

### [ ] Evidence Service — Complete Undo Execution

**Files:**
- `agent/services/evidence_service.py`

**Reference:** `new_docs/architecture.md` §3.6, `new_docs/workflow.md` §8

**Tasks:**
1. Implement `execute_undo(tool_call_id)` function:
   - Retrieve `undo_plan_json` from `tool_calls` table
   - Parse undo steps (may include Composio tool calls, manual instructions, or revert commands)
   - Execute each step:
     - For Composio tools: call reversal tools (e.g., delete email draft, revert CRM field)
     - For manual steps: return instructions for reviewer to execute
   - Hash undo payload (SHA-256) for tamper detection
   - Update `tool_calls.undo_status` annotation (success, failed, manual_required)
   - Log outcome to `safeguard_events`
2. Implement `hash_tool_args(args)` function:
   - Deterministic JSON canonicalization (sorted keys)
   - Redact PII fields before hashing (emails, phone numbers, SSNs)
   - Return SHA-256 hash as hex string
3. Implement `bundle_proof_pack(mission_id)` function:
   - Collect mission brief from `objectives` table
   - Collect selected plays from `plays` table
   - Collect tool call summaries from `tool_calls` table (redacted)
   - Collect safeguard feedback from `safeguard_events` table
   - Collect ROI estimates (expected vs. actual)
   - Generate Markdown summary + JSON payload
   - Upload to Supabase Storage `evidence-artifacts` bucket if >200 KB
   - Persist metadata to `artifacts` table (content_ref, hash, size_bytes)
4. Implement `store_artifact(play_id, type, title, content)` function:
   - Upload large payloads (>200 KB) to Supabase Storage
   - Hash content (SHA-256)
   - Store metadata in `artifacts` table
   - Return artifact reference for linking
5. Emit telemetry:
   - `undo_requested` (when undo initiated)
   - `undo_completed` (on successful execution)
   - `undo_failed` (on failure, with error details)

**Acceptance:**
- `execute_undo` successfully executes Composio reversal tools
- Manual undo instructions returned for non-automated steps
- All payloads hashed with SHA-256 for verification
- Proof packs generated with complete mission summary
- Artifacts stored with hash verification
- Telemetry captured for all undo operations
- Integration tests validate undo flow

**Dependencies:**
- `agent/tools/composio_client.py` (Composio tool execution)
- `agent/services/supabase.py` (database access, storage upload)
- `supabase/migrations/0001_init.sql` (tool_calls, artifacts, safeguard_events)

**Priority:** P0

---

## API & Database

### [ ] POST /api/composio/connect — Complete Connect Link Integration

**Files:**
- `src/app/api/composio/connect/route.ts`
- `src/app/api/composio/connect/route.test.ts`

**Reference:** `libs_docs/composio/llms.txt` §4.1-§4.2

**Tasks:**
1. Implement `POST /api/composio/connect` endpoint:
   - Accept `{ tenantId, toolkit, scopes?, redirectUri? }` payload
   - Call Composio SDK `toolkits.authorize(userId, toolkit)` or `connectedAccounts.link(...)`
   - Return `{ redirectUrl, connectionId, status }`
   - Store pending connection in session state or temporary table
2. Implement `GET /api/composio/connect/callback` endpoint:
   - Accept OAuth callback from Composio
   - Call `waitForConnection(connectionId)` to retrieve connected account
   - Encrypt access token with AES-GCM before storing
   - Store encrypted token in `oauth_tokens` table with fingerprint (SHA-256 of plaintext token)
   - Return success status to frontend
3. Add token rotation logic:
   - Monitor `expires_at` in `oauth_tokens` table
   - Refresh token before expiry using Composio SDK
   - Update encrypted token and fingerprint in database
   - Emit telemetry: `oauth_token_rotated`
4. Implement RLS policies for `oauth_tokens`:
   - Tenant-scoped read/write (already in schema)
   - Service role can read for rotation job
5. Add tests:
   - Successful OAuth flow (mock Composio SDK)
   - Token encryption/decryption roundtrip
   - Token refresh logic
   - Error handling (failed auth, expired token, invalid callback)

**Acceptance:**
- `/api/composio/connect` generates valid `redirectUrl`
- OAuth callback successfully stores encrypted token
- Token fingerprint correctly computed (SHA-256)
- Token rotation works before expiry
- All telemetry events captured
- Tests achieve >90% coverage

**Dependencies:**
- Composio SDK (`@composio/core` for TypeScript)
- Crypto library for AES-GCM encryption
- `supabase/migrations/0001_init.sql` (oauth_tokens table)

**Priority:** P0 (blocker)

---

### [ ] POST /api/inspect/preview — Implement MCP Draft Mode Validation

**Files:**
- `src/app/api/inspect/preview/route.ts`
- `src/app/api/inspect/preview/route.test.ts`
- `agent/agents/validator.py` (inspection validation)

**Reference:** `new_docs/workflow.md` §4.1, `libs_docs/composio/llms.txt` §5.3

**Tasks:**
1. Implement `POST /api/inspect/preview` endpoint:
   - Accept `{ tenantId, missionId, selectedToolkits }` payload
   - For each toolkit, execute sample MCP draft calls (e.g., fetch 5 sample contacts, list top tickets)
   - Use Composio simulation mode: `execution_mode='SIMULATION'` or draft APIs
   - Collect results:
     - Data coverage (% of expected fields populated)
     - Data freshness (last update timestamp)
     - Authorization status (scopes sufficient?)
     - Sample data summaries (count, field examples)
   - Calculate readiness percentage (0-100%):
     - 100% = all toolkits authorized, full coverage, fresh data
     - <85% = gaps in coverage, stale data, or missing scopes
   - Store findings in `inspection_findings` table
   - Return `{ readiness, findings, gaps }` payload
2. Emit telemetry:
   - `inspection_preview_rendered` (with readiness %, finding count)
   - `plan_validated` (if readiness ≥85%)
   - `plan_validation_failed` (if readiness <85%)
3. Wire validator agent to consume inspection findings:
   - Validator queries `inspection_findings` for mission
   - Cross-checks against accepted safeguards
   - Returns validation outcome (auto_fix, ask_reviewer, retry_later)
4. Add tests:
   - Successful inspection with ≥85% readiness
   - Failed inspection with <85% readiness
   - Missing scopes detected and surfaced
   - Stale data flagged with freshness threshold

**Acceptance:**
- Inspection preview executes MCP draft calls correctly
- Readiness percentage calculated accurately
- Findings stored in `inspection_findings` table
- Validator agent processes findings and returns correct outcomes
- All telemetry events captured
- Tests achieve >85% coverage

**Dependencies:**
- Composio SDK (simulation/draft mode)
- `agent/agents/validator.py`
- `supabase/migrations/0001_init.sql` (inspection_findings table)

**Priority:** P1

---

### [ ] Database Schema — Add Missing Indexes and Policies

**Files:**
- `supabase/migrations/0001_init.sql`

**Reference:** `new_docs/architecture.md` §3.5, `new_docs/workflow.md` §10

**Tasks:**
1. Verify all RLS policies are tenant-scoped (`tenant_id = auth.uid()`)
2. Add missing indexes for query performance:
   - `mission_metadata`: composite index on `(mission_id, field, accepted_at)`
   - `mission_safeguards`: composite index on `(mission_id, status, hint_type)`
   - `safeguard_events`: composite index on `(mission_id, event_type, created_at desc)`
   - `planner_runs`: index on `latency_ms` for performance tracking
3. Add comments to all tables and columns for documentation
4. Verify analytics views are correct:
   - `analytics_planner_performance`
   - `analytics_generative_acceptance`
   - `analytics_connection_adoption`
   - `analytics_undo_success`
5. Test RLS policies:
   - Verify cross-tenant access is denied
   - Verify service role can access all rows
   - Verify authenticated users can access own rows only
6. Run `supabase db diff` and capture migration hash in `docs/readiness/migration_log_G-B.md`

**Acceptance:**
- All indexes present and optimized for common queries
- RLS policies tested and verified secure
- Analytics views return correct data
- Migration hash captured in readiness docs
- Database performance meets targets (<100ms for common queries)

**Dependencies:**
- Supabase CLI for migration testing

**Priority:** P1

---

## Telemetry & Analytics

### [ ] Telemetry Audit — Ensure Complete Event Coverage

**Files:**
- `src/lib/telemetry/client.ts`
- `src/app/api/intake/events/route.ts`
- `agent/services/telemetry.py`

**Reference:** `new_docs/ux.md` §10, `new_docs/workflow.md` §12

**Tasks:**
1. Audit all components and agents for telemetry coverage per UX catalog:
   - Frontend events (35 events listed in UX §10.2)
   - Backend events (agent lifecycle, tool calls, validator decisions)
   - Eight-stage flow events (stage transitions, completions, failures)
2. Verify all events include required fields:
   - `tenant_id`, `mission_id`, `event_name`, `event_data`, `created_at`
   - PII redaction applied before storage
3. Add missing events:
   - `stage_intake_completed`
   - `stage_toolkits_started`
   - `stage_toolkits_completed`
   - `stage_inspect_started`
   - `stage_inspect_completed`
   - `stage_plan_validated`
   - `stage_dry_run_stage_completed` (for each sub-stage)
   - `toolkit_recommendation_viewed`
   - `toolkit_selected`
   - `toolkit_deselected`
   - `oauth_initiated`
   - `oauth_completed`
   - `inspection_preview_rendered`
   - `plan_validated`
   - `plan_validation_failed`
4. Implement telemetry export script:
   - Query `mission_events` table for date range
   - Export to CSV with columns: `event_name`, `mission_id`, `tenant_id`, `created_at`, `event_data`
   - Redact PII in export
   - Save to `docs/readiness/telemetry_audit_G-B.csv`
5. Run audit script and verify:
   - All 35+ UX events present
   - All stage transition events present
   - No missing events for dry-run missions
   - Event sequence matches expected flow

**Acceptance:**
- Telemetry audit CSV shows 100% coverage of UX catalog events
- All stage transition events captured
- PII redaction verified in exports
- No gaps in event sequences for test missions
- Audit report saved to `docs/readiness/telemetry_audit_G-B.csv`

**Dependencies:**
- `supabase/migrations/0001_init.sql` (mission_events table)
- `src/lib/telemetry/redaction.ts` (PII redaction logic)

**Priority:** P1 (Gate G-B requirement)

---

### [ ] Analytics Dashboards — Implement KPI Tiles and Charts

**Files:**
- `src/app/(governance)/dashboard/page.tsx` (create if missing)
- `src/components/analytics/KPITile.tsx` (create if missing)
- `src/components/analytics/TrendChart.tsx` (create if missing)

**Reference:** `new_docs/architecture.md` §3.6, `new_docs/ux.md` §8.2-§8.3

**Tasks:**
1. Build Analytics Dashboard page:
   - Layout: 4 KPI tiles at top, trend charts below
   - Filters: Persona, Date Range (Last 7/30/90 days), Mission Status
   - Export button: "Download Report (PDF)"
2. Implement KPI tiles:
   - **Weekly Jobs Approved**: Count from `approvals` where `decision='approved'`
   - **Dry-Run Conversion**: % of dry-run missions that convert to governed
   - **Approval Throughput**: Average time from `approval_required` to `approval_decision`
   - **Safeguard Incidents**: Count from `safeguard_events` where `event_type='violation_detected'`
   - Display week-over-week delta with color coding (green=improving, red=regressing)
3. Implement trend charts:
   - **Weekly Approved Jobs**: Line chart over 12 weeks
   - **Library Reuse**: Bar chart of top 10 plays by reuse count
   - **Planner Performance**: Line chart of p95 latency over time
   - **Safeguard Feedback**: Heatmap of hint types by outcome (accepted/edited/rejected)
4. Add narrative summary card:
   - Auto-generated text summarizing key trends
   - Editable/regenerable controls
   - Stored in `mission_feedback` or dedicated `dashboard_narratives` table
5. Query analytics views from Supabase:
   - `analytics_planner_performance`
   - `analytics_generative_acceptance`
   - `analytics_connection_adoption`
   - `analytics_undo_success`
6. Implement PDF export:
   - Generate PDF with KPI tiles, charts, and narrative summary
   - Include filter parameters and export timestamp
   - Save to temporary location and provide download link

**Acceptance:**
- Dashboard displays all 4 KPI tiles with correct data
- Trend charts render with correct data from analytics views
- Filters work and update charts/tiles accordingly
- Narrative summary generates and is editable
- PDF export works and includes all dashboard content
- Accessibility: keyboard navigation, screen reader support

**Dependencies:**
- `supabase/migrations/0001_init.sql` (analytics views)
- Chart library (e.g., Recharts, D3)
- PDF generation library (e.g., jsPDF, Puppeteer)

**Priority:** P2 (Gate G-D requirement, can start now)

---

## Testing & Quality Assurance

### [ ] Integration Tests — Eight-Stage Flow End-to-End

**Files:**
- `src/components/__tests__/ControlPlaneWorkspace.eightStage.test.tsx` (create)
- `agent/tests/test_eight_stage_flow.py` (create)

**Reference:** `new_docs/workflow.md` §1, `new_docs/todo.md` Gate G-B acceptance

**Tasks:**
1. Build frontend integration test for full eight-stage flow:
   - **Stage 1 (Intake)**: Paste objective, verify chips generated, accept chips
   - **Stage 2 (Brief)**: Verify brief card persisted, safeguards generated
   - **Stage 3 (Toolkits)**: Select toolkits, verify selections persisted, connect OAuth (mock)
   - **Stage 4 (Inspect)**: Verify inspection preview rendered, coverage meter shows ≥85%
   - **Stage 5 (Plan)**: Select play, verify planner insight rail displays rationale
   - **Stage 6 (Dry-Run)**: Verify streaming status panel updates, dry-run completes <15 min (mock)
   - **Stage 7 (Evidence)**: Verify artifact gallery displays proof pack, undo button visible
   - **Stage 8 (Feedback)**: Submit feedback, verify persisted to database
   - Assert telemetry events for all stage transitions
   - Assert database state after each stage
2. Build backend integration test for agent flow:
   - Mock Supabase calls
   - Mock Composio SDK calls
   - Execute Coordinator agent with test mission
   - Verify IntakeAgent → PlannerAgent → ExecutionLoop → Validator → Evidence sequence
   - Verify telemetry events emitted
   - Verify database writes (mission_metadata, plays, tool_calls, artifacts)
3. Add dry-run stopwatch test:
   - Execute 3 persona scenarios (Revenue, Support, Finance)
   - Record timestamps from intent submission to evidence bundle creation
   - Verify <15 minutes per run (mock execution, focus on orchestration)
   - Archive results in `docs/readiness/dry_run_verification.md`
4. Add streaming resilience test:
   - Use Playwright or Cypress to test streaming status panel
   - Assert timeline updates every ≤5 seconds (mock heartbeat)
   - Test approval modal interaction
   - Verify `copilotkit_exit` event fires
5. Add evidence hash parity test:
   - Generate artifacts with Evidence service
   - Compute SHA-256 hash of content
   - Verify hash matches `artifacts.hash` field in database
   - Ensure 100% parity across all artifacts

**Acceptance:**
- Frontend integration test covers all 8 stages
- Backend integration test validates agent orchestration
- Dry-run stopwatch confirms <15 min performance
- Streaming resilience test passes with <5s heartbeat
- Evidence hash parity test achieves 100% match
- All tests pass in CI/CD pipeline

**Dependencies:**
- Vitest + React Testing Library (frontend)
- pytest + mocking libraries (backend)
- Playwright or Cypress (E2E streaming)

**Priority:** P0 (Gate G-B requirement)

---

### [ ] ADK Eval Suites — Expand Coverage

**Files:**
- `agent/evals/dry_run_ranking_G-B.json`
- `agent/evals/validator_outcomes_G-B.json` (create)
- `agent/evals/evidence_bundling_G-B.json` (create)

**Reference:** `new_docs/todo.md` Gate G-B §Planner Ranking & Library Intelligence, `libs_docs/adk/llms-full.txt`

**Tasks:**
1. Expand `dry_run_ranking_G-B.json` eval suite:
   - Add 5 personas × 3 scenarios each = 15 test cases
   - Cover GTM/Support/Ops/Finance/Engineering personas
   - Assert planner latency ≤2.5s
   - Assert top-3 similarity ≥0.62
   - Assert at least 1 `no_auth` toolkit in dry-run recommendations
2. Create `validator_outcomes_G-B.json` eval suite:
   - Test tone violations (auto-fix, ask_reviewer outcomes)
   - Test quiet hour violations (retry_later outcome)
   - Test budget cap violations (ask_reviewer outcome)
   - Test escalation triggers (ask_reviewer outcome)
   - Assert correct outcome type for each safeguard type
3. Create `evidence_bundling_G-B.json` eval suite:
   - Test proof pack generation with various mission configurations
   - Assert all required fields present (brief, plays, tool calls, safeguards, ROI)
   - Assert hash verification passes
   - Assert undo plan included for all mutating tool calls
4. Run all eval suites:
   - `mise run test-agent` executes all suites
   - Assert pass rate ≥90%
   - Capture results in `docs/readiness/planner_eval_G-B.json`
5. Integrate into CI:
   - Fail builds if eval pass rate <90%
   - Generate eval report artifact for review

**Acceptance:**
- All eval suites pass with ≥90% success rate
- Eval results logged to `docs/readiness/planner_eval_G-B.json`
- CI pipeline runs evals on every PR
- Eval failures block merges

**Dependencies:**
- Gemini ADK eval framework
- Mock Supabase and Composio clients for deterministic tests

**Priority:** P1 (Gate G-B requirement)

---

## Documentation & Evidence

### [ ] Evidence Artifacts — Generate All Required Files

**Files:**
- `docs/readiness/copilotkit_stream_contract_G-B.md` (create)
- `docs/readiness/copilotkit_session_G-B.mp4` (create)
- `docs/readiness/library_seed_log_G-B.md` (create)
- `docs/readiness/planner_eval_G-B.json` (auto-generated)
- `docs/readiness/evidence_bundle_sample_G-B.json` (create)
- `docs/readiness/evidence_hash_report_G-B.json` (create)
- `docs/readiness/undo_trace_G-B.md` (create)
- `docs/readiness/message_retention_G-B.csv` (create)
- `docs/readiness/generative_quality_report_G-B.md` (create)
- `docs/readiness/generative_quality_notes_G-B.md` (create)
- `docs/readiness/reviewer_workflow_G-B.md` (create)
- `docs/readiness/status_beacon_B.json` (create)
- `docs/readiness/risk_register_G-B.json` (create)

**Reference:** `new_docs/todo.md` Gate G-B §Evidence Artifacts

**Tasks:**
1. **CopilotKit Stream Contract** (`copilotkit_stream_contract_G-B.md`):
   - Document all streaming event payloads (planner_stage_started, executor_status, etc.)
   - Include TypeScript types for each event
   - Document `copilotkit_emit_message` and `copilotkit_exit` contracts
   - Include examples with sample payloads
2. **CopilotKit Session Video** (`copilotkit_session_G-B.mp4`):
   - Record screencast of full dry-run mission from intake to evidence
   - Show streaming status panel updates in real-time
   - Show approval modal interaction
   - Include console logs showing telemetry events
   - Max 5 minutes duration
3. **Library Seed Log** (`library_seed_log_G-B.md`):
   - Run `scripts/seed_library.py` (create if missing)
   - Seed at least 5 plays × 5 personas = 25 library entries
   - Capture command output showing:
     - Number of entries seeded
     - Embedding generation success rate
     - Provenance metadata (source, persona, success_score)
   - Save output to file
4. **Evidence Bundle Sample** (`evidence_bundle_sample_G-B.json`):
   - Generate proof pack for one complete dry-run mission
   - Include all required sections: brief, plays, tool calls, safeguards, ROI, telemetry
   - Redact PII
   - Validate against TypeScript types
5. **Evidence Hash Report** (`evidence_hash_report_G-B.json`):
   - Run `python scripts/verify_artifact_hashes.py` (create if missing)
   - Verify 100% hash parity between Supabase Storage and `artifacts` table
   - Export results with columns: artifact_id, storage_hash, db_hash, match, created_at
6. **Undo Trace** (`undo_trace_G-B.md`):
   - Execute one undo operation
   - Document timeline: request → execution → completion
   - Include tool call details, undo plan steps, outcome
   - Show telemetry events (undo_requested, undo_completed)
7. **Message Retention CSV** (`message_retention_G-B.csv`):
   - Run `python scripts/check_retention.py --table copilot_messages --ttl-days 7` (create if missing)
   - Verify soft-deletion of messages older than 7 days
   - Export results with columns: session_id, message_count, deleted_count, cutoff_timestamp
8. **Generative Quality Report** (`generative_quality_report_G-B.md`):
   - Run `python scripts/analyze_edit_rates.py` (create if missing)
   - Analyze `mission_metadata` for acceptance %, regeneration counts, confidence scores
   - Generate report with:
     - Acceptance rate per field (objective, audience, KPIs, safeguards)
     - Confidence vs. edit scatter plots
     - Regeneration count distribution
     - Baseline from ≥3 pilot tenants (10 missions each)
   - Assert ≥70% acceptance and ≤3 regenerations median
9. **Generative Quality Notes** (`generative_quality_notes_G-B.md`):
   - Conduct 3 moderated user sessions
   - Capture quotes and insights about generative quality
   - Log follow-up actions in backlog
10. **Reviewer Workflow SOP** (`reviewer_workflow_G-B.md`):
    - Draft decision tree: accept ↔ request changes ↔ escalate
    - Include safeguard interpretation guidance
    - Document undo expectations
    - Create flowchart (export as SVG)
11. **Status Beacon** (`status_beacon_B.json`):
    - Format: `{ gate: "G-B", readiness_pct: 95, owners: {...}, blockers: [], updated_at: "2025-10-12" }`
    - Calculate readiness based on checklist completion
    - List remaining blockers with mitigation plans
12. **Risk Register** (`risk_register_G-B.json`):
    - Document risks: streaming regressions, telemetry gaps, storage failures, prompt drift, reviewer backlog
    - For each risk: description, likelihood, impact, mitigation, owner

**Acceptance:**
- All 13 evidence artifacts present in `docs/readiness/`
- All artifacts pass quality review (no placeholders, complete data)
- Artifacts referenced in status beacon
- Ready for Gate G-B promotion review

**Dependencies:**
- Scripts in `scripts/` directory for automation
- Screen recording software for video
- Pilot tenants for quality analysis

**Priority:** P0 (Gate G-B requirement)

---

### [ ] Documentation — Update All Cross-References

**Files:**
- `README.md`
- `AGENTS.md`
- `new_docs/architecture.md`
- `new_docs/prd.md`
- `new_docs/ux.md`
- `new_docs/workflow.md`
- `new_docs/todo.md`

**Reference:** N/A (maintenance)

**Tasks:**
1. Update `README.md`:
   - Add Gate G-B status badge
   - Update getting started instructions
   - Add links to new evidence artifacts
2. Update `AGENTS.md`:
   - Document all agent types (Coordinator, Planner, Executor, Validator, Evidence)
   - Include eval suite instructions
   - Document telemetry emission patterns
3. Verify cross-references in `new_docs/`:
   - All §references resolve correctly
   - All file paths are accurate
   - All URLs are valid
4. Add date stamps to all documentation files (2025-10-12)
5. Regenerate Supabase TypeScript types:
   - Run `supabase gen types typescript --local > src/types/supabase.ts`
   - Verify all new tables included (toolkit_selections, inspection_findings, etc.)

**Acceptance:**
- All cross-references resolve correctly
- Date stamps updated
- Supabase types generated and validated
- No broken links or references

**Dependencies:**
- Supabase CLI

**Priority:** P2 (polish)

---

## Appendix A: Evidence Artifacts

### Required for Gate G-B Promotion

All artifacts must be present in `docs/readiness/` before Gate G-B promotion:

1. ✅ `status_beacon_A.json` (Gate G-A baseline)
2. ✅ `migration_log_G-A.md` (Supabase schema hash)
3. ✅ `composio_status_G-A.txt` (SDK status output)
4. ⚠️ `copilotkit_qa_G-A/` (screenshots + logs) — README placeholder only
5. ⚠️ `generative_intake_samples_G-A.json` — incomplete
6. ⚠️ `copilotkit_stream_contract_G-B.md` — missing
7. ⚠️ `copilotkit_session_G-B.mp4` — missing
8. ⚠️ `library_seed_log_G-B.md` — missing
9. ⚠️ `planner_eval_G-B.json` — missing
10. ⚠️ `evidence_bundle_sample_G-B.json` — missing
11. ⚠️ `evidence_hash_report_G-B.json` — missing
12. ⚠️ `undo_trace_G-B.md` — missing
13. ⚠️ `message_retention_G-B.csv` — missing
14. ⚠️ `generative_quality_report_G-B.md` — missing
15. ⚠️ `generative_quality_notes_G-B.md` — missing
16. ⚠️ `reviewer_workflow_G-B.md` — missing
17. ⚠️ `status_beacon_B.json` — missing
18. ⚠️ `risk_register_G-B.json` — missing
19. ⚠️ `telemetry_audit_G-B.csv` — missing
20. ⚠️ `dry_run_verification.md` — missing

---

## Appendix B: Gate Promotion Criteria

### Gate G-B Exit Criteria

**Must have:**
- ✅ Eight-stage state machine implemented and tested
- ⚠️ All 13+ evidence artifacts present in `docs/readiness/`
- ⚠️ Telemetry audit shows 100% coverage of UX catalog events
- ⚠️ Integration tests pass for full eight-stage flow
- ⚠️ ADK eval suites pass with ≥90% success rate
- ⚠️ Dry-run cycle time <15 min p95 verified
- ⚠️ Streaming heartbeat latency ≤5 s p95 verified
- ⚠️ Planner ranking latency ≤2.5 s p95 verified
- ⚠️ Evidence hash parity 100% verified
- ⚠️ Message retention policy enforced (7 days)
- ⚠️ Generative acceptance ≥70% per field verified
- ⚠️ Safeguard hint adoption ≥60% verified
- ⚠️ Governance sign-off documented in `governance_signoff_G-B.md`
- ⚠️ Status beacon reports ≥95% readiness

**Nice to have:**
- Accessibility audit report (Gate G-E requirement, can defer)
- Analytics dashboards live (Gate G-D requirement, can defer)
- Complete undo execution (functional but not fully polished)

---

## Open Questions & Assumptions

### Open Questions

1. **Composio Connect Link UI pattern**: Should OAuth flow open in popup, new tab, or iframe? **Decision needed** before UI integration.

2. **Coverage meter threshold**: Is 85% readiness threshold appropriate, or should it be configurable per tenant? **Recommendation:** Keep 85% fixed for Gate G-B, make configurable in Gate G-C.

3. **Undo time window**: 24 hours is specified, but should high-risk actions have longer windows? **Recommendation:** Keep 24h default, allow mission-level override via safeguards.

4. **Library seeding**: Who provides initial 25 library entries (5 plays × 5 personas)? **Recommendation:** Product team seeds baseline, customers can add custom entries.

5. **Telemetry retention**: Mission events stored indefinitely or purged? **Recommendation:** Keep indefinitely for compliance, add export option for archival.

6. **Narrative summarization**: Should narrative generation use Gemini or Claude? **Recommendation:** Use same model as intake generation for consistency.

### Assumptions

1. **Pilot tenants**: Assume ≥3 pilot tenants available for generative quality baseline analysis.

2. **Composio quota**: Assume sufficient API quota for 25 library entries × discovery calls during seeding.

3. **Supabase storage**: Assume sufficient storage quota for evidence artifacts (estimate ~500 MB per 100 missions).

4. **CI/CD pipeline**: Assume CI can run ADK eval suites (requires Gemini API access in CI environment).

5. **Screen recording**: Assume team has access to screen recording software for CopilotKit session video.

6. **Moderated sessions**: Assume ability to schedule 3 user sessions for generative quality feedback.

7. **Governance sign-off**: Assume Governance Sentinel + Runtime Steward availability for final review before promotion.

8. **Browser compatibility**: Target modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+). No IE11 support.

9. **Mobile support**: Responsive design for tablet (768px+), but mobile (<768px) is deprioritized until Gate G-E.

10. **Time zone handling**: All quiet hours and timestamps use mission-local time zone (stored in safeguard hints).

---

## Change Log

- **2025-10-12**: Initial comprehensive todo created based on full documentation review
- Cross-referenced against architecture.md, prd.md, ux.md, workflow.md, todo.md, safeguard_integration.md
- Mined requirements from partner libraries (adk, composio, copilotkit, supabase)
- Analyzed current codebase (frontend components, backend agents, API routes, database schema)
- Identified 75% Gate G-B completion with specific blockers and action items

---

**Next Steps:**
1. Prioritize P0 tasks (blockers) for immediate attention
2. Schedule governance review for risk register and readiness assessment
3. Begin evidence artifact generation for quick wins (logs, reports, samples)
4. Kick off integration test development in parallel with Connect Link integration
5. Schedule pilot tenant sessions for generative quality baseline

**Estimated time to Gate G-B completion:** 3-4 weeks with current velocity
