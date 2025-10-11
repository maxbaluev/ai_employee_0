# ControlPlaneWorkspace Safeguard Integration Review

## Executive Summary

This document provides a comprehensive analysis of the reviewer/safeguard integration in the ControlPlaneWorkspace component, covering existing handlers, telemetry events, and test simulation strategies.

---

## 1. Architecture Overview

### Key Components

1. **ControlPlaneWorkspace** (`src/app/(control-plane)/ControlPlaneWorkspace.tsx`)
   - Main orchestrator component
   - Manages safeguard state, mission brief, and approval flow
   - Lines 115-1476

2. **useApprovalFlow Hook** (`src/hooks/useApprovalFlow.ts`)
   - Manages approval modal state and submission logic
   - Handles API communication to `/api/approvals`
   - Lines 46-192

3. **ApprovalModal Component** (`src/components/ApprovalModal.tsx`)
   - UI for reviewer decision-making
   - Displays safeguards, undo summary, and decision options
   - Lines 64-400

4. **SafeguardDrawer Component** (`src/components/SafeguardDrawer.tsx`)
   - Manages safeguard hints (accept, edit, pin, regenerate)
   - Displays history of safeguard mutations
   - Referenced at lines 14-18, 376-386

---

## 2. Safeguard Data Flow

### 2.1 Safeguard Sources

**Mission Brief Loading** (lines 192-247):
```typescript
// Fetches from /api/missions/{objectiveId}/brief
const payload = await response.json();
const safeguards = payload.brief.safeguards; // Array<{ hintType: string | null; text: string }>
```

**Intake Acceptance** (lines 1000-1058):
```typescript
// Parsed from guardrailSummary string
const acceptedSafeguards = (guardrailSummary ?? '')
  .split(/\n+/)
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((text) => ({ hintType: null, text }));
```

### 2.2 Safeguard Normalization

**normalizeSafeguards Function** (lines 84-113):
- Converts raw safeguards to `SafeguardDrawerHint[]`
- Assigns unique IDs using `buildSafeguardId` (lines 76-82)
- Preserves existing state (status, pinned, rationale) from previous hints
- Default status: `"accepted"`

**SafeguardDrawerHint Type**:
```typescript
{
  id: string;                    // Generated from hintType + text hash + occurrence
  label: string;                 // Display text
  hintType: string;             // Type of safeguard (e.g., "tone", "budget_limit")
  status: "accepted" | "edited"; // Current state
  confidence: number | null;     // Optional confidence score
  pinned: boolean;               // User-pinned flag
  rationale: string | null;      // Optional explanation
  lastUpdatedAt: string | null;  // ISO timestamp
}
```

### 2.3 Accepted Safeguards for Approval

**acceptedSafeguardEntries** (lines 139-150):
```typescript
const acceptedSafeguardEntries = useMemo<SafeguardEntry[]>(
  () =>
    safeguards
      .filter((entry) => entry.status === "accepted")
      .map((entry) => ({
        type: entry.hintType ?? "safeguard",
        value: entry.label,
        confidence: typeof entry.confidence === "number" ? entry.confidence : undefined,
        pinned: entry.pinned ?? false,
      })),
  [safeguards],
);
```

**SafeguardEntry Type** (from useApprovalFlow.ts:9-14):
```typescript
{
  type: string;         // Safeguard type
  value: string;        // Safeguard text/value
  confidence?: number;  // Optional confidence score
  pinned?: boolean;     // Whether user has pinned this
}
```

---

## 3. Safeguard User Actions

### 3.1 Accept All (lines 345-370)

**Handler**: `handleSafeguardAcceptAll`

**Actions**:
1. Updates all safeguards to status `"accepted"`
2. Appends history entries for each safeguard
3. Emits telemetry: `safeguard_hint_accept_all`
4. Persists via POST to `/api/safeguards`

**Telemetry Event Data**:
```typescript
{
  hint_ids: string[];   // Array of all safeguard IDs
  hint_count: number;   // Total count
}
```

**API Payload**:
```typescript
{
  action: "accept_all",
  hintIds: string[],
  tenantId: string,
  missionId: string
}
```

### 3.2 Accept Single (lines 372-400)

**Handler**: `handleSafeguardAccept`

**Actions**:
1. Updates specific safeguard to status `"accepted"`
2. Appends single history entry
3. Emits telemetry: `safeguard_hint_applied`
4. Persists via POST to `/api/safeguards`

**Telemetry Event Data**:
```typescript
{
  hint_id: string;      // Safeguard ID
  hint_type: string;    // Safeguard type
}
```

### 3.3 Edit Safeguard (lines 402-436)

**Handler**: `handleSafeguardEdit`

**Actions**:
1. Prompts user for new text via `window.prompt()`
2. Updates safeguard with new label and status `"edited"`
3. Appends history entry
4. Emits telemetry: `safeguard_hint_edited`
5. Persists via POST to `/api/safeguards`

**Telemetry Event Data**:
```typescript
{
  hint_id: string;
  hint_type: string;
  text_length: number;  // Length of new text
}
```

### 3.4 Regenerate (lines 438-448)

**Handler**: `handleSafeguardRegenerate`

**Actions**:
1. Emits telemetry: `safeguard_hint_regenerate_requested`
2. Persists via POST to `/api/safeguards`

### 3.5 Toggle Pin (lines 450-474)

**Handler**: `handleSafeguardTogglePin`

**Actions**:
1. Updates pinned state
2. Appends history entry with status `"pinned"` or `"unpinned"`
3. Emits telemetry: `safeguard_hint_toggle_pin`
4. Persists via POST to `/api/safeguards`

**Telemetry Event Data**:
```typescript
{
  hint_id: string;
  hint_type: string;
  pinned: boolean;
}
```

---

## 4. Reviewer Flow (Approval Modal)

### 4.1 Triggering Approval Request

**handleReviewerRequested** (lines 928-963):

Invoked by `StreamingStatusPanel` when a validator requests reviewer decision.

**Flow**:
1. Extracts `tool_call_id` from timeline message metadata
2. Retrieves optional `undo_summary` for display in modal
3. Calls `approvalFlow.openApproval()` with:
   - `toolCallId`: Unique identifier for the tool call requiring approval
   - `missionId`: Current mission identifier
   - `stage`: Mission stage (e.g., "validator_reviewer_requested")
   - `attempt`: Retry attempt number (optional)
   - `metadata`: Additional context
   - `safeguards`: All accepted safeguard entries (filtered from `acceptedSafeguardEntries`)

**Telemetry Emitted**:
- Event: `approval_required`
- Location: `useApprovalFlow.ts:66-74`
- Data:
  ```typescript
  {
    tool_call_id: string;
    stage: string | null;
    attempt: number | null;
  }
  ```

### 4.2 Approval Modal UI

**ApprovalModal Component** (lines 64-400 in ApprovalModal.tsx):

**Key Features**:
1. **Safeguard Chips Display** (lines 219-240)
   - Shows all active safeguards with type, value, and confidence
   - Visual indicator: violet-themed chips

2. **Decision Options** (lines 277-294)
   - `approved`: "Approve dry-run" — Confident in safeguards and undo plan
   - `needs_changes`: "Needs revision" — Send back with required edits
   - `rejected`: "Reject request" — Block release and log guardrail violation

3. **Reviewer Notes** (lines 296-309)
   - Free-text justification field
   - Optional but recommended for audit trail

4. **Guardrail Violation Toggle** (lines 311-328)
   - Checkbox: "Log guardrail violation"
   - Additional notes field for violation details

5. **Undo Summary** (lines 260-275)
   - Displays undo plan if provided
   - Amber-themed warning card

6. **Keyboard Shortcuts** (lines 145-179)
   - `Escape`: Close modal
   - `Ctrl/⌘ + Enter`: Submit decision
   - `Tab`: Focus trap within modal

### 4.3 Submission Flow

**submitApproval** (useApprovalFlow.ts:83-179):

**Request Payload** (lines 99-109):
```typescript
{
  tenantId: string;
  missionId: string | null;
  toolCallId: string;
  reviewerId?: string;
  decision: "approved" | "rejected" | "needs_changes";
  justification?: string;
  metadata: Record<string, unknown>;
  guardrailViolation?: {
    violated: boolean;
    notes?: string;
  };
  safeguards: SafeguardEntry[];
}
```

**API Endpoint**: POST `/api/approvals`

**Success Response**:
```typescript
{
  approval: {
    id: string | null;
  }
}
```

**Conflict Handling** (lines 121-127):
- HTTP 409: Approval already recorded by another reviewer
- Returns existing decision in error payload
- Modal displays conflict warning with current state

**Telemetry Events**:

1. **approval_decision** (lines 138-148):
   ```typescript
   {
     tool_call_id: string;
     decision: "approved" | "rejected" | "needs_changes";
     has_guardrail_violation: boolean;
     has_safeguards: boolean;
     safeguards_count: number;
   }
   ```

2. **reviewer_annotation_created** (lines 153-161) — Only if justification or violation notes exist:
   ```typescript
   {
     tool_call_id: string;
     decision: string;
     has_guardrail_violation: boolean;
   }
   ```

**Success Callback** (ControlPlaneWorkspace.tsx:297-303):
```typescript
onSuccess: ({ decision }) => {
  const label = decision.replace(/_/g, " ");
  setWorkspaceAlert({
    tone: "success",
    message: `Reviewer decision recorded (${label}).`,
  });
}
```

---

## 5. Telemetry Events Reference

### 5.1 Safeguard Events

| Event Name | Trigger | Data Fields |
|------------|---------|-------------|
| `safeguard_hint_accept_all` | Accept All button clicked | `hint_ids`, `hint_count` |
| `safeguard_hint_applied` | Single safeguard accepted | `hint_id`, `hint_type` |
| `safeguard_hint_edited` | Safeguard text edited | `hint_id`, `hint_type`, `text_length` |
| `safeguard_hint_regenerate_requested` | Regenerate clicked | `hint_id`, `hint_type` |
| `safeguard_hint_toggle_pin` | Pin toggled | `hint_id`, `hint_type`, `pinned` |
| `safeguard_hint_history_opened` | History drawer opened | `entry_count` |
| `safeguard_hint_history_closed` | History drawer closed | `entry_count` |

### 5.2 Approval Events

| Event Name | Trigger | Data Fields |
|------------|---------|-------------|
| `approval_required` | Approval modal opened | `tool_call_id`, `stage`, `attempt` |
| `approval_decision` | Approval submitted | `tool_call_id`, `decision`, `has_guardrail_violation`, `has_safeguards`, `safeguards_count` |
| `reviewer_annotation_created` | Justification/notes provided | `tool_call_id`, `decision`, `has_guardrail_violation` |

### 5.3 Mission Brief Events

| Event Name | Trigger | Data Fields |
|------------|---------|-------------|
| `mission_brief_loaded` | Brief fetched from API | `kpi_count`, `safeguard_count` |
| `mission_brief_pinned` | Brief displayed to user | `kpi_count`, `safeguard_count` |
| `mission_brief_updated` | Intake acceptance | `source`, `kpi_count`, `safeguard_count` |

### 5.4 Telemetry Implementation

**Client Function** (`src/lib/telemetry/client.ts:11-36`):
```typescript
export async function sendTelemetryEvent(
  tenantId: string,
  payload: TelemetryEventPayload,
): Promise<void> {
  const safePayload = {
    tenantId,
    eventName: payload.eventName,
    missionId: payload.missionId ?? undefined,
    eventData: payload.eventData ? redactTelemetryEvent(payload.eventData) : {},
  };

  await fetch('/api/intake/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(safePayload),
  });
}
```

**Redaction** (`src/lib/telemetry/redaction.ts`):
- Strips email addresses → `[redacted-email]`
- Strips phone numbers → `[redacted-phone]`
- Strips API tokens → `[redacted-token]`

---

## 6. Testing Strategy

### 6.1 Existing Test Infrastructure

**Test Files**:
- `src/hooks/__tests__/useApprovalFlow.test.ts` — Hook behavior
- `src/components/__tests__/ApprovalModal.test.tsx` — UI interactions
- `src/components/__tests__/ControlPlaneWorkspace.test.tsx` — Integration tests

**Test Utilities** (from ControlPlaneWorkspace.test.tsx):

1. **advanceToEvidenceStage** (lines 374-397)
   - Completes Intake → Toolkits → Inspect → Plan → Dry Run → Evidence
   - Uses `streamingStatusPanelPropsRef` to simulate callbacks

2. **getStageNode** (lines 363-372)
   - Queries mission stage progression nav
   - Returns stage list item for assertions

3. **Mock Implementations**:
   - `fetchMock`: Configurable fetch responses
   - `telemetryMock`: Tracks telemetry calls
   - `streamingStatusPanelPropsRef`: Captures callback props

### 6.2 Simulating Accept All Flow

**Test Pattern**:
```typescript
it('emits telemetry when Accept All is clicked', async () => {
  const user = userEvent.setup();

  // Setup: Render workspace with safeguards
  render(
    <ControlPlaneWorkspace
      tenantId={tenantId}
      initialObjectiveId={missionId}
      initialArtifacts={[]}
      catalogSummary={null}
    />
  );

  // Accept intake to populate safeguards
  await user.click(screen.getByRole('button', { name: /Complete Intake/i }));

  // Clear telemetry to isolate Accept All event
  telemetryMock.mockClear();

  // Find SafeguardDrawer and click Accept All
  const drawer = screen.getByLabelText('Safeguard Drawer');
  const acceptAllButton = within(drawer).getByRole('button', { name: /Accept All/i });
  await user.click(acceptAllButton);

  // Assert telemetry
  await waitFor(() => {
    expect(telemetryMock).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        eventName: 'safeguard_hint_accept_all',
        eventData: expect.objectContaining({
          hint_count: expect.any(Number),
        }),
      }),
    );
  });
});
```

**Key Assertions**:
- Safeguard status updated to `"accepted"`
- History entries added
- API call to `/api/safeguards` with `action: "accept_all"`
- Telemetry event emitted with correct hint IDs and count

### 6.3 Simulating Reviewer Approval Flow

**Test Pattern**:
```typescript
it('submits approval with safeguards via ApprovalModal', async () => {
  const user = userEvent.setup();

  // Mock API responses
  fetchMock.mockImplementation((url: string, options: RequestInit) => {
    if (url === '/api/approvals') {
      const body = JSON.parse(options.body as string);
      expect(body.safeguards).toBeDefined();
      expect(body.decision).toBe('approved');

      return Promise.resolve(
        new Response(JSON.stringify({ approval: { id: 'approval-123' } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  });

  const { result } = renderHook(() =>
    useApprovalFlow({
      tenantId,
      missionId,
      onSuccess: vi.fn(),
    })
  );

  // Open approval with safeguards
  act(() => {
    result.current.openApproval({
      toolCallId: 'tool-call-123',
      missionId,
      stage: 'validator_reviewer_requested',
      safeguards: [
        { type: 'tone', value: 'professional', confidence: 0.92 },
        { type: 'budget_limit', value: '$5000' },
      ],
    });
  });

  // Submit approval
  await act(async () => {
    const submitResult = await result.current.submitApproval({
      decision: 'approved',
      justification: 'All safeguards verified',
    });
    expect(submitResult.ok).toBe(true);
  });

  // Assert telemetry
  expect(telemetryMock).toHaveBeenCalledWith(
    tenantId,
    expect.objectContaining({
      eventName: 'approval_decision',
      eventData: expect.objectContaining({
        has_safeguards: true,
        safeguards_count: 2,
        decision: 'approved',
      }),
    })
  );
});
```

### 6.4 Testing Safeguard Passthrough to ApprovalModal

**Integration Test Pattern**:
```typescript
it('passes accepted safeguards to approval modal', async () => {
  const user = userEvent.setup();

  render(
    <ControlPlaneWorkspace
      tenantId={tenantId}
      initialObjectiveId={null}
      initialArtifacts={[]}
      catalogSummary={null}
    />
  );

  // Accept intake with safeguards
  await user.click(screen.getByRole('button', { name: /Complete Intake/i }));

  // Advance to stage that triggers approval
  await advanceToEvidenceStage(user);

  // Simulate reviewer request
  act(() => {
    streamingStatusPanelPropsRef.current?.onReviewerRequested?.({
      metadata: {
        tool_call_id: 'test-tool-call',
        undo_summary: 'Test undo plan',
      },
      stage: 'validator_reviewer_requested',
    });
  });

  // Assert modal displays safeguards
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  const safeguardChips = screen.getAllByText(/professional|tone/i);
  expect(safeguardChips.length).toBeGreaterThan(0);
});
```

### 6.5 Mock Configuration Examples

**Telemetry Mock Setup** (lines 19-20 in ControlPlaneWorkspace.test.tsx):
```typescript
const telemetryMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: telemetryMock,
}));
```

**Fetch Mock for Approvals** (example):
```typescript
fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString();

  if (url === '/api/approvals') {
    const payload = JSON.parse(init?.body as string);

    // Simulate conflict
    if (payload.toolCallId === 'conflicted-tool-call') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: 'Approval already recorded',
            existingApproval: { decision: 'rejected' },
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    // Success
    return Promise.resolve(
      new Response(
        JSON.stringify({ approval: { id: crypto.randomUUID() } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }

  // Default fallback
  return Promise.resolve(new Response('{}', { status: 200 }));
});
```

---

## 7. Key Integration Points

### 7.1 Safeguard → Approval Flow

**Data Path**:
1. Mission Brief loads safeguards → `setMissionBrief()` → `setSafeguards(normalizeSafeguards(...))`
2. User clicks "Accept All" → `handleSafeguardAcceptAll()` → Status = "accepted"
3. `acceptedSafeguardEntries` memo filters to accepted safeguards
4. StreamingStatusPanel triggers reviewer → `handleReviewerRequested()` → `approvalFlow.openApproval()`
5. ApprovalModal receives `safeguardChips` via `acceptedSafeguardEntries`
6. User submits decision → `submitApproval()` includes safeguards in payload
7. API persists approval with safeguards to `/api/approvals`

**Critical Code Locations**:
- Safeguard normalization: `ControlPlaneWorkspace.tsx:84-113`
- Accepted safeguards filter: `ControlPlaneWorkspace.tsx:139-150`
- Approval submission: `useApprovalFlow.ts:83-179`
- ApprovalModal safeguard display: `ApprovalModal.tsx:219-240`

### 7.2 Telemetry Critical Path

**Event Sequence for Full Approval Flow**:
1. `mission_brief_loaded` — Brief fetched
2. `mission_brief_pinned` — Brief displayed
3. `safeguard_hint_accept_all` — User accepts all safeguards
4. `approval_required` — Modal opened
5. `approval_decision` — Decision submitted
6. `reviewer_annotation_created` — (Optional) If justification provided

**Test Assertion Pattern**:
```typescript
const telemetryEvents = telemetryMock.mock.calls.map(([, payload]) => payload.eventName);
expect(telemetryEvents).toContain('safeguard_hint_accept_all');
expect(telemetryEvents).toContain('approval_decision');

const decisionEvent = telemetryMock.mock.calls.find(
  ([, payload]) => payload.eventName === 'approval_decision'
);
expect(decisionEvent[1].eventData).toMatchObject({
  has_safeguards: true,
  safeguards_count: expect.any(Number),
});
```

---

## 8. Common Edge Cases

### 8.1 Empty Safeguards

**Scenario**: No safeguards provided in mission brief

**Handling**:
- `acceptedSafeguardEntries` returns empty array
- ApprovalModal displays no safeguard chips (lines 220-240 conditional render)
- Approval submission payload includes `safeguards: []`
- Telemetry: `has_safeguards: false`, `safeguards_count: 0`

### 8.2 Concurrent Reviewer Conflict

**Scenario**: Two reviewers submit decisions simultaneously

**Handling** (useApprovalFlow.ts:121-127):
- API returns HTTP 409 with existing approval
- Modal displays conflict warning (ApprovalModal.tsx:345-375)
- `latestDecision` state updated to existing decision
- User sees amber warning: "Concurrent reviewer detected"

### 8.3 Safeguard Status Transitions

**Valid Transitions**:
- `accepted` → `edited` (user edits text)
- `accepted` → `pinned` (user pins, status remains `accepted`)
- `edited` → `accepted` (user re-accepts after edit)

**Invalid Transition**:
- `accepted` → `rejected` (not implemented — safeguards are either accepted or edited, never explicitly rejected)

### 8.4 Undo Summary Display

**Scenario**: Approval request includes undo plan

**Handling** (ControlPlaneWorkspace.tsx:944-948):
```typescript
const derivedUndoSummary =
  typeof message.metadata?.undo_summary === 'string'
    ? message.metadata.undo_summary
    : undefined;
setApprovalUndoSummary(derivedUndoSummary);
```

**Modal Display** (ApprovalModal.tsx:260-275):
- Amber-themed warning card
- Icon: Warning triangle
- Title: "Undo plan"
- Body: Undo summary text

---

## 9. Testing Checklist

### 9.1 Safeguard Acceptance Tests

- [ ] Accept All updates all safeguard statuses to "accepted"
- [ ] Accept All emits `safeguard_hint_accept_all` telemetry
- [ ] Accept All persists via POST to `/api/safeguards`
- [ ] Single accept updates only target safeguard
- [ ] Single accept emits `safeguard_hint_applied` telemetry
- [ ] History entries added for all safeguard actions

### 9.2 Approval Flow Tests

- [ ] `handleReviewerRequested` opens ApprovalModal with correct props
- [ ] Modal displays all accepted safeguards as chips
- [ ] Modal displays undo summary if provided
- [ ] Submission includes safeguards in API payload
- [ ] `approval_required` telemetry emitted on modal open
- [ ] `approval_decision` telemetry emitted on submission
- [ ] `reviewer_annotation_created` telemetry emitted if justification exists
- [ ] Success callback displays workspace alert

### 9.3 Integration Tests

- [ ] Mission brief loading populates safeguards
- [ ] Intake acceptance creates safeguards from guardrailSummary
- [ ] Accepted safeguards filter correctly to `acceptedSafeguardEntries`
- [ ] ApprovalModal receives safeguards via `safeguardChips` prop
- [ ] Safeguards persist through entire approval flow
- [ ] Telemetry events fire in correct sequence

### 9.4 Edge Case Tests

- [ ] Empty safeguards handled gracefully
- [ ] Concurrent approval conflict displays warning
- [ ] Undo summary displayed when present
- [ ] Guardrail violation checkbox functionality
- [ ] Keyboard shortcuts work in modal
- [ ] Focus trap works correctly

---

## 10. Recommended Test Implementations

### 10.1 Unit Test: Accept All Flow

**File**: `src/components/__tests__/ControlPlaneWorkspace.test.tsx`

```typescript
it('accepts all safeguards and passes to approval modal', async () => {
  const user = userEvent.setup();
  const tenantId = 'test-tenant-id';
  const missionId = 'test-mission-id';

  fetchMock.mockImplementation((url: string) => {
    if (url.includes('/api/safeguards')) {
      return Promise.resolve(new Response('{}', { status: 200 }));
    }
    if (url.includes('/api/approvals')) {
      return Promise.resolve(
        new Response(JSON.stringify({ approval: { id: 'approval-1' } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  });

  render(
    <ControlPlaneWorkspace
      tenantId={tenantId}
      initialObjectiveId={null}
      initialArtifacts={[]}
      catalogSummary={null}
    />
  );

  // Complete intake to populate safeguards
  await user.click(screen.getByRole('button', { name: /Complete Intake/i }));

  // Accept all safeguards
  const drawer = screen.getByLabelText('Safeguard Drawer');
  await user.click(within(drawer).getByRole('button', { name: /Accept All/i }));

  // Verify telemetry
  await waitFor(() => {
    expect(telemetryMock).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ eventName: 'safeguard_hint_accept_all' })
    );
  });

  // Simulate reviewer request
  act(() => {
    streamingStatusPanelPropsRef.current?.onReviewerRequested({
      metadata: { tool_call_id: 'test-tool-call' },
      stage: 'validator_reviewer_requested',
    });
  });

  // Assert modal displays safeguards
  await waitFor(() => {
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText(/Active safeguards/i)).toBeInTheDocument();
    expect(within(modal).getByText(/professional/i)).toBeInTheDocument();
  });

  // Submit approval
  await user.click(screen.getByRole('button', { name: /Submit decision/i }));

  // Verify approval API called with safeguards
  await waitFor(() => {
    const approvalCall = fetchMock.mock.calls.find(([url]) => url === '/api/approvals');
    expect(approvalCall).toBeDefined();
    const payload = JSON.parse(approvalCall[1].body);
    expect(payload.safeguards).toHaveLength(1);
    expect(payload.safeguards[0].value).toBe('Maintain professional tone');
  });
});
```

### 10.2 Integration Test: End-to-End Approval with Safeguards

**File**: `src/components/__tests__/ControlPlaneWorkspace.test.tsx`

```typescript
it('completes full approval flow with safeguards from intake to submission', async () => {
  const user = userEvent.setup();
  const tenantId = 'test-tenant-id';

  fetchMock.mockImplementation((url: string, options?: RequestInit) => {
    if (url.includes('/api/approvals')) {
      const body = JSON.parse(options?.body as string);
      expect(body.safeguards).toBeDefined();
      expect(body.safeguards.length).toBeGreaterThan(0);

      return Promise.resolve(
        new Response(JSON.stringify({ approval: { id: 'approval-123' } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  });

  render(
    <ControlPlaneWorkspace
      tenantId={tenantId}
      initialObjectiveId={null}
      initialArtifacts={[]}
      catalogSummary={null}
    />
  );

  // Step 1: Complete intake (populates safeguards)
  await user.click(screen.getByRole('button', { name: /Complete Intake/i }));

  // Step 2: Accept all safeguards
  const drawer = screen.getByLabelText('Safeguard Drawer');
  await user.click(within(drawer).getByRole('button', { name: /Accept All/i }));

  // Step 3: Trigger reviewer request
  act(() => {
    streamingStatusPanelPropsRef.current?.onReviewerRequested({
      metadata: {
        tool_call_id: 'end-to-end-tool-call',
        undo_summary: 'Rollback campaign draft',
      },
      stage: 'validator_reviewer_requested',
    });
  });

  // Step 4: Verify modal displays safeguards and undo summary
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  expect(screen.getByText(/Active safeguards/i)).toBeInTheDocument();
  expect(screen.getByText(/Undo plan/i)).toBeInTheDocument();
  expect(screen.getByText('Rollback campaign draft')).toBeInTheDocument();

  // Step 5: Add justification
  const justificationField = screen.getByRole('textbox', { name: /Reviewer notes/i });
  await user.type(justificationField, 'All safeguards verified and compliant');

  // Step 6: Submit approval
  await user.click(screen.getByRole('button', { name: /Submit decision/i }));

  // Step 7: Verify telemetry sequence
  await waitFor(() => {
    const eventNames = telemetryMock.mock.calls.map(([, p]) => p.eventName);
    expect(eventNames).toContain('mission_brief_updated');
    expect(eventNames).toContain('safeguard_hint_accept_all');
    expect(eventNames).toContain('approval_required');
    expect(eventNames).toContain('approval_decision');
    expect(eventNames).toContain('reviewer_annotation_created');
  });

  // Step 8: Verify success alert
  expect(
    await screen.findByText(/Reviewer decision recorded \(approved\)/i)
  ).toBeInTheDocument();
});
```

---

## 11. API Contract Summary

### POST `/api/safeguards`

**Request**:
```typescript
{
  tenantId: string;
  missionId: string;
  action: "accept_all" | "accept" | "edit" | "regenerate" | "toggle_pin";
  hintIds?: string[];  // For accept_all
  hintId?: string;     // For single actions
  text?: string;       // For edit
  pinned?: boolean;    // For toggle_pin
}
```

**Response**: `{ ok: true }` (200)

### POST `/api/approvals`

**Request**:
```typescript
{
  tenantId: string;
  missionId: string | null;
  toolCallId: string;
  reviewerId?: string;
  decision: "approved" | "rejected" | "needs_changes";
  justification?: string;
  metadata: Record<string, unknown>;
  guardrailViolation?: {
    violated: boolean;
    notes?: string;
  };
  safeguards: Array<{
    type: string;
    value: string;
    confidence?: number;
    pinned?: boolean;
  }>;
}
```

**Response**:
```typescript
{
  approval: {
    id: string | null;
  }
}
```

**Error (409 Conflict)**:
```typescript
{
  error: string;
  existingApproval: {
    decision: "approved" | "rejected" | "needs_changes";
  };
}
```

---

## 12. Future Enhancement Opportunities

1. **Safeguard Rejection Flow**
   - Add explicit "reject" status for safeguards
   - Track rejected safeguards separately from accepted

2. **Safeguard Confidence Threshold**
   - Filter safeguards below confidence threshold
   - Display warning for low-confidence safeguards

3. **Approval History Display**
   - Show previous reviewer decisions in modal
   - Display timestamp and reviewer ID

4. **Safeguard Diff View**
   - Show changes when safeguards are edited
   - Compare original vs. current text

5. **Bulk Safeguard Operations**
   - Select multiple safeguards for batch actions
   - Pin/unpin multiple safeguards at once

---

## 13. Quick Reference

### Key File Locations

- **ControlPlaneWorkspace**: `src/app/(control-plane)/ControlPlaneWorkspace.tsx`
- **useApprovalFlow**: `src/hooks/useApprovalFlow.ts`
- **ApprovalModal**: `src/components/ApprovalModal.tsx`
- **Telemetry Client**: `src/lib/telemetry/client.ts`
- **Integration Tests**: `src/components/__tests__/ControlPlaneWorkspace.test.tsx`

### Critical Line Numbers

| Function/Feature | File | Lines |
|------------------|------|-------|
| normalizeSafeguards | ControlPlaneWorkspace.tsx | 84-113 |
| acceptedSafeguardEntries | ControlPlaneWorkspace.tsx | 139-150 |
| handleSafeguardAcceptAll | ControlPlaneWorkspace.tsx | 345-370 |
| handleReviewerRequested | ControlPlaneWorkspace.tsx | 928-963 |
| submitApproval | useApprovalFlow.ts | 83-179 |
| ApprovalModal render | ApprovalModal.tsx | 189-399 |

### Test Helper Functions

- `advanceToEvidenceStage(user)` — Complete all stages to Evidence
- `getStageNode(label)` — Query stage progression item
- `streamingStatusPanelPropsRef.current` — Access panel callbacks
- `telemetryMock.mock.calls` — Inspect telemetry events
- `fetchMock.mock.calls` — Inspect API calls

---

**Document Version**: 1.0
**Last Updated**: 2025-10-11
**Branch**: `code-claude-review-controlplaneworkspace-safeguard`
