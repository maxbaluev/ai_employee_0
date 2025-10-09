/// <reference types="vitest" />

import { act, renderHook } from '@testing-library/react';

import { useUndoFlow } from '../useUndoFlow';

const telemetryMock = vi.hoisted(() => ({
  sendTelemetryEvent: vi.fn(async () => {}),
}));

vi.mock('@/lib/telemetry/client', () => telemetryMock);

describe('useUndoFlow', () => {
  const tenantId = '3c33212c-d119-4ef1-8db0-2ca93cd3b2dd';
  const missionId = '11111111-1111-1111-1111-111111111111';
  const toolCallId = 'artifact-dry-run-123';

  afterEach(() => {
    vi.restoreAllMocks();
    telemetryMock.sendTelemetryEvent.mockClear();
  });

  it('emits undo telemetry and returns completion status', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'completed' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      );

    const completionSpy = vi.fn();

    const { result } = renderHook(() =>
      useUndoFlow({
        tenantId,
        missionId,
        onCompleted: completionSpy,
      }),
    );

    const undoResult = await act(async () =>
      result.current.requestUndo({
        toolCallId,
        reason: 'Testing undo telemetry',
      }),
    );

    expect(undoResult).toEqual({ ok: true, status: 'completed', message: undefined });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(telemetryMock.sendTelemetryEvent).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ eventName: 'undo_requested' }),
    );
    expect(completionSpy).toHaveBeenCalledWith('completed');
  });
});
