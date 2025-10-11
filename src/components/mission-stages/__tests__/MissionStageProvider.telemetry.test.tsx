import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { MissionStageProvider, useMissionStages } from '../MissionStageProvider';
import { MissionStage } from '../types';

const sendTelemetryEventMock = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: sendTelemetryEventMock,
}));

describe('MissionStageProvider telemetry', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MissionStageProvider tenantId="tenant-telemetry" missionId="mission-telemetry">
      {children}
    </MissionStageProvider>
  );

  beforeEach(() => {
    vi.useFakeTimers();
    sendTelemetryEventMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    sendTelemetryEventMock.mockClear();
  });

  it('emits stage_plan_started with metadata when markStageStarted is called', () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    act(() => {
      result.current.markStageStarted(MissionStage.Plan, { source: 'unit-test' });
    });

    const call = sendTelemetryEventMock.mock.calls.find(
      ([, payload]) => payload.eventName === 'stage_plan_started',
    );

    expect(call).toBeDefined();
    expect(call?.[0]).toBe('tenant-telemetry');
    expect(call?.[1]).toMatchObject({
      missionId: 'mission-telemetry',
      eventData: expect.objectContaining({
        stage: MissionStage.Plan,
        timestamp: expect.any(String),
        source: 'unit-test',
      }),
    });
  });

  it('emits stage_plan_completed with duration metadata', () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    act(() => {
      result.current.markStageStarted(MissionStage.Plan);
    });

    vi.advanceTimersByTime(2_500);

    act(() => {
      result.current.markStageCompleted(MissionStage.Plan, { outcome: 'success' });
    });

    const call = sendTelemetryEventMock.mock.calls.find(
      ([, payload]) => payload.eventName === 'stage_plan_completed',
    );

    expect(call).toBeDefined();
    const [, payload] = call!;
    expect(payload.eventData).toMatchObject({
      stage: MissionStage.Plan,
      outcome: 'success',
      duration: expect.any(Number),
    });
    expect(payload.eventData.duration).toBeGreaterThanOrEqual(2_500);
  });

  it('emits stage_plan_failed with duration metadata', () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    act(() => {
      result.current.markStageStarted(MissionStage.Plan);
    });

    vi.advanceTimersByTime(1_500);

    act(() => {
      result.current.markStageFailed(MissionStage.Plan, { reason: 'timeout' });
    });

    const call = sendTelemetryEventMock.mock.calls.find(
      ([, payload]) => payload.eventName === 'stage_plan_failed',
    );

    expect(call).toBeDefined();
    const [, payload] = call!;
    expect(payload.eventData).toMatchObject({
      stage: MissionStage.Plan,
      reason: 'timeout',
      duration: expect.any(Number),
    });
    expect(payload.eventData.duration).toBeGreaterThanOrEqual(1_500);
  });
});
