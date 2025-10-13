# Generative Intake Playbook — Gate G-A

**Status:** Implementation complete
**Version:** 1.0
**Date:** October 8, 2025
**Owner:** Engineering, Product

---

## Executive Summary

This playbook documents the **Generative Mission Intake** system for Gate G-A. It converts freeform user input (goals, links, context) into structured mission chips: objective, audience, KPIs, and adaptive safeguard hints. The system uses **Google Gemini API** with a **deterministic fallback** to ensure reliable generation even when AI services are unavailable.

All generated data is persisted to Supabase (`mission_metadata`, `mission_safeguards`) with confidence scores, source tracking, regeneration counts, and timestamps. Telemetry events (`intent_submitted`, `brief_generated`, `brief_item_modified`) are captured in the `mission_events` table.

---

## Architecture

### Components

1. **Intake Service** (`src/lib/intake/service.ts`)
   - Handles generation logic
   - Integrates with Gemini API (placeholder ready for production key)
   - Provides deterministic fallback with heuristic parsing
   - Persists to Supabase tables

2. **API Endpoints**
   - `POST /api/intake/generate` — Generate intake from raw text
   - `POST /api/intake/regenerate` — Regenerate specific fields

3. **UI Component** (`src/components/MissionIntake.tsx`)
   - Renders generative intake banner
   - Displays editable chips with confidence badges
   - Integrates with CopilotKit for agent actions

4. **Database Schema** (`supabase/migrations/0001_init.sql`)
   - `mission_metadata` — One row per field (`objective`, `audience`, `kpis`) capturing value JSON, confidence, source, regeneration count, accepted_at
   - `mission_safeguards` — Adaptive safeguard hints with typed payload (`suggested_value`), confidence, generation_count, status lifecycle
   - `mission_events` — Telemetry log for `intent_submitted`, `brief_generated`, `brief_item_modified`

---

## Generative Prompts

### Gemini Intake Prompt

The prompt sent to Gemini API (`buildIntakePrompt` function):

```
You are an AI mission intake assistant for an enterprise control plane.

Extract structured mission data from the following user input:

"""
{user raw text}
{links if provided}
"""

Return a JSON object with this exact structure:
{
  "objective": "A concise one-sentence mission objective",
  "audience": "Target audience or stakeholder group",
  "kpis": [
    { "label": "KPI name", "target": "Optional target value" }
  ],
  "safeguardHints": [
    {
      "type": "tone" | "quiet_hours" | "escalation" | "budget",
      "text": "Brief safeguard recommendation",
      "confidence": 0.0-1.0
    }
  ],
  "confidence": 0.0-1.0
}

Guidelines:
- Extract objective as a clear, actionable goal
- Identify primary audience from context
- Suggest 2-3 relevant KPIs if possible
- Propose 2-4 adaptive safeguard hints based on tone, timing, escalation needs
- Set confidence based on clarity of input (0.9+ for clear, 0.6-0.8 for ambiguous)
- If input is too vague, use confidence <0.6 and provide best-effort defaults

Return ONLY the JSON, no explanation.
```

**Model:** `gemini-pro` (or `gemini-1.5-flash` for speed)

**Environment Variable:** `GEMINI_API_KEY`

---

## Fallback Behavior

When Gemini is unavailable (missing API key, network failure, or invalid response), the system uses a **deterministic fallback** (`generateWithFallback` function).

### Fallback Heuristics

1. **Objective Extraction**
   - First sentence of input becomes objective
   - Fallback: "Define mission objective"

2. **Audience Detection**
   - Search for keywords: "team", "users", "customers", "stakeholders", "executives", "board"
   - Fallback: "General audience"

3. **KPI Generation**
   - Default: "Completion rate → 100%"
   - If input >50 words: Add "Time to delivery → 2 weeks"

4. **Safeguard Hints**
   - Always include:
     - Tone: "Maintain professional, warm tone" (confidence 0.7)
     - Quiet hours: "Respect quiet hours 8pm-7am local time" (confidence 0.8)
   - Conditional:
     - If keywords "important", "critical", "urgent", "executive" detected:
       - Escalation: "Escalate high-risk actions to human reviewer" (confidence 0.75)

5. **Confidence Scoring**
   - Base: 0.6
   - +0.1 if input >20 words
   - +0.1 if links provided
   - +0.05 if "objective" or "goal" keywords present
   - Cap: 0.85 (fallback never claims high confidence)

---

## Telemetry Mapping

All telemetry events are emitted to the `mission_events` table via the `emitTelemetry` function.

### Event Catalog

| Event Name | Trigger | Payload | Purpose |
|------------|---------|---------|---------|
| `intent_submitted` | User submits raw input | `{ input_chars, link_count }` | Track input length, link usage |
| `brief_generated` | Intake generation completes | `{ mission_id, confidence_scores, generated_fields, source }` | Measure generation quality, source distribution |
| `brief_item_modified` | User edits/regenerates a chip | `{ mission_id, field, action }` | Identify low-confidence fields needing improvement |

### Analytics Queries

#### Generation Source Distribution

```sql
SELECT
  event_data->>'source' AS source,
  COUNT(*) AS generation_count
FROM mission_events
WHERE event_name = 'brief_generated'
GROUP BY source;
```

Expected: `gemini` dominates in production, `fallback` <20%

#### Low-Confidence Generations

```sql
SELECT
  mission_id,
  event_data->'confidence_scores'->>'overall' AS confidence
FROM mission_events
WHERE event_name = 'brief_generated'
  AND (event_data->'confidence_scores'->>'overall')::numeric < 0.7
ORDER BY created_at DESC;
```

Low confidence (<0.7) indicates ambiguous input or fallback activation.

#### Field Modification Rate

```sql
SELECT
  event_data->>'field' AS field,
  COUNT(*) AS modification_count
FROM mission_events
WHERE event_name = 'brief_item_modified'
GROUP BY field
ORDER BY modification_count DESC;
```

High modification rates indicate prompt tuning opportunities.

---

## Database Schema Reference

### mission_metadata

| Column | Type | Description |
|--------|------|-------------|
| `mission_id` | uuid | References `objectives.id` (part of primary key) |
| `tenant_id` | uuid | References `auth.users.id` (part of primary key) |
| `field` | text | `objective`, `audience`, or `kpis` |
| `value` | jsonb | Structured value (`{ text }` or `{ items: [...] }`) |
| `confidence` | numeric | Confidence score 0-1 |
| `source` | text | `gemini` or `fallback` |
| `regeneration_count` | integer | Incremented each time a field is regenerated |
| `accepted_at` | timestamptz | Timestamp when user accepted the field (nullable) |
| `created_at` | timestamptz | Initial write timestamp |
| `updated_at` | timestamptz | Last update timestamp |

### mission_safeguards

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `mission_id` | uuid | References `objectives.id` |
| `tenant_id` | uuid | References `auth.users.id` |
| `hint_type` | text | `tone`, `quiet_hours`, `escalation`, `budget` |
| `suggested_value` | jsonb | `{ text: string }` payload |
| `confidence` | numeric | Hint confidence 0-1 |
| `status` | text | `suggested`, `accepted`, `edited`, or `rejected` |
| `source` | text | `gemini` or `fallback` |
| `generation_count` | integer | Bumped for regenerated hint sets |
| `accepted_at` | timestamptz | Timestamp when status moved to accepted/edited/rejected |
| `created_at` | timestamptz | Initial write timestamp |
| `updated_at` | timestamptz | Last update timestamp |

### mission_events

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `mission_id` | uuid | References `objectives.id` (nullable) |
| `tenant_id` | uuid | References `auth.users.id` |
| `event_name` | text | Event type (see catalog above) |
| `event_data` | jsonb | Event-specific payload |
| `created_at` | timestamptz | Event timestamp |

---

## UI Integration

### MissionIntake Component

**Location:** `src/components/MissionIntake.tsx`

**Features:**
- Freeform textarea for input (supports Ctrl+Enter to generate)
- Token count display
- Confidence badges (High/Medium/Low)
- Editable chips for objective, audience
- KPI display (read-only in Gate G-A)
- Safeguard hints with accept/edit controls
- "Accept All" and "Reset" actions

**CopilotKit Actions:**
- `generateMissionIntake` — Agent can trigger generation
- `acceptMissionIntake` — Agent can accept chips on behalf of user

### ControlPlaneWorkspace Integration

**Location:** `src/app/(control-plane)/ControlPlaneWorkspace.tsx`

The `MissionIntake` component is rendered at the top of the workspace (after header, before mission brief sidebar). Accepted chips sync to:
- Local mission state
- Supabase `objectives` table
- CopilotKit session state

---

## Production Deployment Checklist

### Environment Variables

- [ ] `GEMINI_API_KEY` — Google Gemini API key (required for AI generation)
- [ ] `SUPABASE_URL` — Supabase project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — Service role key for server-side operations

### Migration

```bash
# Apply migration
supabase db push

# Verify tables
supabase db inspect
```

Expected tables: `mission_metadata`, `mission_safeguards`, `mission_events`

### Testing

1. **Fallback Mode** (no `GEMINI_API_KEY`)
   - Submit freeform text
   - Verify confidence <0.85
   - Check `source: 'fallback'` in database

2. **Gemini Mode** (with `GEMINI_API_KEY`)
   - Submit clear objective
   - Verify confidence >0.85
   - Check `source: 'gemini'` in database

3. **Regeneration**
   - Edit objective chip
   - Click "Regenerate"
   - Verify `generation_count` increments

4. **Telemetry**
   - Check `mission_events` table
   - Verify `intent_submitted`, `brief_generated`, `brief_item_modified` events

---

## Prompt Tuning Strategy

### Metrics to Monitor

1. **Confidence Distribution**
   - Target: 80% of generations have confidence >0.8
   - If <70%, review prompt clarity

2. **Modification Rate**
   - Target: <30% of chips modified by users
   - If >50%, tune prompt to better extract user intent

3. **Source Distribution**
   - Target: >80% Gemini (with API key)
   - If fallback >20%, investigate API failures

### Iteration Process

1. Collect low-confidence examples from `mission_events`
2. Review user modifications (field-specific patterns)
3. Update `buildIntakePrompt` with refined instructions
4. A/B test new prompt with 10% of traffic
5. Roll out if confidence +5% or modification rate -10%

---

## Known Limitations (Gate G-A)

1. **KPI Regeneration** — Not implemented; would require dedicated endpoint
2. **Safeguard Regeneration** — Not implemented; would require hint-level regeneration
3. **Multi-Language Support** — Prompts assume English input
4. **Gemini Fallback Retry** — No exponential backoff; fails immediately to fallback
5. **Confidence Calibration** — Confidence thresholds are heuristic; needs real-world tuning

---

## Future Enhancements (Gate G-B+)

- **Contextual Regeneration** — Allow users to provide feedback ("Make it more casual")
- **Auto-Save Drafts** — Persist incomplete intake to session state
- **Link Parsing** — Extract metadata from provided URLs (page titles, descriptions)
- **Toolkit Suggestion** — Recommend toolkits based on objective keywords
- **Multi-Persona Prompts** — Tailor prompt style by user role (executive, engineer, marketer)

---

## Support & Escalation

**Questions:** Reach engineering team via Slack #control-plane-dev
**Bugs:** File issue in GitHub repository
**Prompt Improvements:** Submit PR to `src/lib/intake/service.ts` with justification

---

**Maintained by:** Engineering Team
**Last Updated:** October 8, 2025
**Cross-References:** `new_docs/ux.md`, `docs/readiness/status_beacon_A.json`
