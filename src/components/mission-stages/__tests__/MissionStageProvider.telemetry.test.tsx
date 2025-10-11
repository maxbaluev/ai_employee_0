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

  it('emits stage_plan_started after preceding stages complete', async () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    const completeStage = async (stage: MissionStage) => {
      await act(async () => {
        result.current.markStageCompleted(stage);
        await Promise.resolve();
      });
    };

    // Complete earlier stages to satisfy ordering guard
    await completeStage(MissionStage.Intake);
    await completeStage(MissionStage.Brief);
    await completeStage(MissionStage.Toolkits);

    // Ignore telemetry emitted while progressing through earlier stages
    sendTelemetryEventMock.mockClear();

    await completeStage(MissionStage.Inspect);

    const planStatus = result.current.stages.get(MissionStage.Plan);
    expect(planStatus?.state).toBe('active');

    sendTelemetryEventMock.mockClear();

    await act(async () => {
      result.current.markStageStarted(MissionStage.Plan, { source: 'unit-test' });
      await Promise.resolve();
    });

    const updatedPlanStatus = result.current.stages.get(MissionStage.Plan);
    expect(updatedPlanStatus?.metadata).toMatchObject({ source: 'unit-test' });

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
      }),
    });
  });

  it('emits stage_plan_completed with duration metadata', async () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    const completeStage = async (stage: MissionStage) => {
      await act(async () => {
        result.current.markStageCompleted(stage);
        await Promise.resolve();
      });
    };

    await completeStage(MissionStage.Intake);
    await completeStage(MissionStage.Brief);
    await completeStage(MissionStage.Toolkits);
    await completeStage(MissionStage.Inspect);

    vi.advanceTimersByTime(2_500);

    // Ignore telemetry emitted while progressing to Plan
    sendTelemetryEventMock.mockClear();

    await act(async () => {
      result.current.markStageCompleted(MissionStage.Plan, { outcome: 'success' });
      await Promise.resolve();
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
    expect(payload.eventData.duration).toBeGreaterThan(0);
    expect(payload.eventData.duration).toBeGreaterThanOrEqual(2_500);
  });

  it('emits stage_plan_failed with duration metadata', async () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    const completeStage = async (stage: MissionStage) => {
      await act(async () => {
        result.current.markStageCompleted(stage);
        await Promise.resolve();
      });
    };

    await completeStage(MissionStage.Intake);
    await completeStage(MissionStage.Brief);
    await completeStage(MissionStage.Toolkits);
    await completeStage(MissionStage.Inspect);

    vi.advanceTimersByTime(1_500);

    // Ignore telemetry emitted while progressing to Plan
    sendTelemetryEventMock.mockClear();

    await act(async () => {
      result.current.markStageFailed(MissionStage.Plan, { reason: 'timeout' });
      await Promise.resolve();
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
    expect(payload.eventData.duration).toBeGreaterThan(0);
    expect(payload.eventData.duration).toBeGreaterThanOrEqual(1_500);
  });
});
