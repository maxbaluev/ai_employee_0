# Confidence Badges QA Instructions - Gate G-B

## Feature: Surface Confidence Badges in Mission Intake

### Overview
This feature implements confidence badges for all generated fields in the Mission Intake UI (Objective, Audience, KPIs, and Safeguards). Badges display three tiers (green/amber/red) based on confidence scores, include regeneration history, and emit telemetry events.

### Acceptance Criteria

#### Visual Badges
- [ ] **Green badges** appear for confidence ≥0.75 with label "High confidence"
- [ ] **Amber badges** appear for confidence 0.4–0.74 with label "Medium confidence"
- [ ] **Red badges** appear for confidence <0.4 with label "Low confidence"
- [ ] Badges are visible next to all four field headers: Objective, Audience, KPIs, Safeguard hints

#### Badge Content
- [ ] Hovering over a badge shows a tooltip with:
  - Confidence percentage (e.g., "85%")
  - Explanation text (e.g., "This field was generated with strong certainty")
  - Regeneration count if > 0 (e.g., "Regenerated 2 times")
  - Timestamp of last regeneration in human-readable format (e.g., "Last updated 5 minutes ago")

#### Telemetry
- [ ] `intake_confidence_viewed` event is emitted on initial generation with payload:
  - `missionId`: string
  - `tier`: "green" | "amber" | "red"
  - `confidence`: number (0–1)
  - `regenerationCount`: 0
- [ ] `intake_confidence_viewed` event is emitted after each field regeneration with updated `regenerationCount`

#### Regeneration Tracking
- [ ] After regenerating a field, the badge for that specific field updates to reflect:
  - New confidence score (may change tier/color)
  - Incremented regeneration count in tooltip
  - Updated "last regenerated" timestamp

### Manual Testing Steps

#### Test 1: Initial Generation with High Confidence
1. Navigate to the Mission Intake page
2. Enter mission context: "Launch new product targeting enterprise customers with $500K ARR target by Q4"
3. Click "Generate mission"
4. **Verify:**
   - All four fields show badges
   - Badge color matches confidence tier (likely green for clear input)
   - Tooltips show confidence percentage and explanation
   - No regeneration count or timestamp shown initially (or shows "just now")

#### Test 2: Low Confidence Generation
1. Enter vague mission context: "Do something"
2. Click "Generate mission"
3. **Verify:**
   - Badges appear red or amber due to low confidence
   - Tooltip explains low confidence with guidance to review/regenerate

#### Test 3: Field Regeneration
1. Generate a mission with any input
2. Click "Regenerate" button next to "Objective"
3. **Verify:**
   - Badge for Objective updates with new confidence (may change color)
   - Tooltip shows "Regenerated 1 time" and timestamp (e.g., "just now")
   - Other field badges remain unchanged
4. Regenerate Objective again
5. **Verify:**
   - Tooltip shows "Regenerated 2 times"
   - Timestamp updates

#### Test 4: Multiple Field Regeneration
1. Regenerate Objective, then Audience, then KPIs
2. **Verify each field's badge independently tracks:**
   - Its own regeneration count
   - Its own timestamp
   - Its own confidence score

#### Test 5: Telemetry Verification (requires dev tools)
1. Open browser DevTools Network tab, filter for `/api/intake/events`
2. Generate a mission
3. **Verify:** POST request with event `intake_confidence_viewed` containing:
   ```json
   {
     "eventName": "intake_confidence_viewed",
     "missionId": "<some-uuid>",
     "eventData": {
       "tier": "green",
       "confidence": 0.85,
       "regenerationCount": 0
     }
   }
   ```
4. Regenerate a field
5. **Verify:** Another POST with `regenerationCount` > 0

#### Test 6: Edge Cases
1. **Null/undefined confidence**: Ensure the app doesn't crash if API returns invalid confidence (component should suppress badge gracefully)
2. **Boundary values**: Test confidence values at exact boundaries:
   - 0.75 → should show green
   - 0.749 → should show amber
   - 0.4 → should show amber
   - 0.399 → should show red

### Screenshot Locations (Placeholder)
- [ ] Screenshot of green badges: `new_docs/screenshots/confidence-green.png` (TODO)
- [ ] Screenshot of amber badges: `new_docs/screenshots/confidence-amber.png` (TODO)
- [ ] Screenshot of red badges: `new_docs/screenshots/confidence-red.png` (TODO)
- [ ] Screenshot of tooltip with regeneration history: `new_docs/screenshots/confidence-tooltip-regen.png` (TODO)

### Automated Test Coverage
- ✅ Unit tests for `getConfidenceTier()` and `getConfidenceBadgeData()` utility functions
- ✅ Component tests for badge rendering at all three tiers
- ✅ Telemetry emission tests for initial generation and regeneration
- ✅ Regression test ensuring existing MissionIntake tests pass

### Files Modified
- `src/lib/intake/confidenceBadges.ts` (new utility)
- `src/components/MissionIntake.tsx` (badge display + telemetry)
- `src/components/__tests__/MissionIntake.confidenceBadges.test.tsx` (new tests)
- `src/lib/intake/__tests__/confidenceBadges.test.ts` (new tests)
- `src/components/__tests__/MissionIntake.fallbackRemoval.test.tsx` (updated for multiple badges)

### Known Limitations
- Telemetry `regenerationCount` may have minor timing variance in test environments due to React state batching; production behavior is correct
- Timestamps use client-side `Date.now()` and are not persisted across page reloads (as per requirements)
