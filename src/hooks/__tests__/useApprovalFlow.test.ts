/// <reference types="vitest" />

import { act, renderHook } from '@testing-library/react';

import { useApprovalFlow } from '../useApprovalFlow';

const telemetryMock = vi.hoisted(() => ({
  sendTelemetryEvent: vi.fn(async () => {}),
}));

vi.mock('@/lib/telemetry/client', () => telemetryMock);

describe('useApprovalFlow', () => {
  const tenantId = '3c33212c-d119-4ef1-8db0-2ca93cd3b2dd';
  const missionId = '11111111-1111-1111-1111-111111111111';
  const toolCallId = '22222222-2222-2222-2222-222222222222';

  afterEach(() => {
    vi.restoreAllMocks();
    telemetryMock.sendTelemetryEvent.mockClear();
  });

  it('emits reviewer annotation telemetry when notes are supplied', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ approval: { id: 'approval-1' } }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        }),
      );

    const { result } = renderHook(() =>
      useApprovalFlow({
        tenantId,
        missionId,
      }),
    );

    act(() => {
      result.current.openApproval({
        toolCallId,
        missionId,
        stage: 'validator_reviewer_requested',
      });
    });

    await act(async () => {
      await result.current.submitApproval({
        decision: 'needs_changes',
        justification: 'Please add ROI estimate.',
        guardrailViolation: { violated: true, notes: 'Tone drift detected' },
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(telemetryMock.sendTelemetryEvent).toHaveBeenNthCalledWith(
      1,
      tenantId,
      expect.objectContaining({ eventName: 'approval_required' }),
    );
    expect(telemetryMock.sendTelemetryEvent).toHaveBeenNthCalledWith(
      2,
      tenantId,
      expect.objectContaining({ eventName: 'approval_decision' }),
    );
    expect(telemetryMock.sendTelemetryEvent).toHaveBeenNthCalledWith(
      3,
      tenantId,
      expect.objectContaining({ eventName: 'reviewer_annotation_created' }),
    );
  });
});
