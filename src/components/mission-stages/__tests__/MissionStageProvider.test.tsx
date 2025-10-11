import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

import { MissionStageProvider, useMissionStages } from '../MissionStageProvider';
import { MissionStage } from '../types';

// Mock the telemetry client
vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: vi.fn(() => Promise.resolve()),
}));

describe('MissionStageProvider', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MissionStageProvider tenantId="test-tenant" missionId="test-mission">
      {children}
    </MissionStageProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with Intake stage active', () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    expect(result.current.currentStage).toBe(MissionStage.Intake);

    const intakeStatus = result.current.stages.get(MissionStage.Intake);
    expect(intakeStatus?.state).toBe('active');
    expect(intakeStatus?.startedAt).toBeTruthy();
  });

  it('should complete a stage and auto-start next stage', () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    act(() => {
      result.current.markStageCompleted(MissionStage.Intake);
    });

    // Intake should be completed
    const intakeStatus = result.current.stages.get(MissionStage.Intake);
    expect(intakeStatus?.state).toBe('completed');
    expect(intakeStatus?.completedAt).toBeTruthy();

    // Brief should be auto-started
    expect(result.current.currentStage).toBe(MissionStage.Brief);
    const briefStatus = result.current.stages.get(MissionStage.Brief);
    expect(briefStatus?.state).toBe('active');
    expect(briefStatus?.startedAt).toBeTruthy();
  });

  it('should calculate stage duration correctly', () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    // Mark stage started
    act(() => {
      result.current.markStageStarted(MissionStage.Intake);
    });

    // Complete the stage
    act(() => {
      result.current.markStageCompleted(MissionStage.Intake);
    });

    const duration = result.current.getStageDuration(MissionStage.Intake);
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(duration).toBeLessThan(1000); // Should be less than 1 second
  });

  it('should mark stage as failed', () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    act(() => {
      result.current.markStageFailed(MissionStage.Intake, { error: 'Test error' });
    });

    const intakeStatus = result.current.stages.get(MissionStage.Intake);
    expect(intakeStatus?.state).toBe('failed');
    expect(intakeStatus?.locked).toBe(true);
    expect(intakeStatus?.metadata?.error).toBe('Test error');
  });

  it('should return next stage correctly', () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    expect(result.current.getNextStage(MissionStage.Intake)).toBe(MissionStage.Brief);
    expect(result.current.getNextStage(MissionStage.Brief)).toBe(MissionStage.Toolkits);
    expect(result.current.getNextStage(MissionStage.Feedback)).toBeNull();
  });

  it('should not restart completed stages', () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    // Complete Intake
    act(() => {
      result.current.markStageCompleted(MissionStage.Intake);
    });

    const firstCompletedAt = result.current.stages.get(MissionStage.Intake)?.completedAt;

    // Try to start it again
    act(() => {
      result.current.markStageStarted(MissionStage.Intake);
    });

    // Should still be completed with same timestamp
    const intakeStatus = result.current.stages.get(MissionStage.Intake);
    expect(intakeStatus?.state).toBe('completed');
    expect(intakeStatus?.completedAt).toBe(firstCompletedAt);
  });

  it('should block Plan from starting before Intake completion', () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    act(() => {
      result.current.markStageStarted(MissionStage.Plan);
    });

    const planStatus = result.current.stages.get(MissionStage.Plan);
    expect(planStatus?.state).toBe('pending');
    expect(result.current.currentStage).toBe(MissionStage.Intake);
  });

  it('should handle stage progression through all stages', () => {
    const { result } = renderHook(() => useMissionStages(), { wrapper });

    const stages = [
      MissionStage.Intake,
      MissionStage.Brief,
      MissionStage.Toolkits,
      MissionStage.Inspect,
      MissionStage.Plan,
      MissionStage.DryRun,
      MissionStage.Evidence,
      MissionStage.Feedback,
    ];

    stages.forEach((stage, index) => {
      expect(result.current.currentStage).toBe(stage);

      act(() => {
        result.current.markStageCompleted(stage);
      });

      const status = result.current.stages.get(stage);
      expect(status?.state).toBe('completed');

      // Check next stage is active (unless this was the last stage)
      if (index < stages.length - 1) {
        const nextStage = stages[index + 1];
        const nextStatus = result.current.stages.get(nextStage);
        expect(nextStatus?.state).toBe('active');
      }
    });

    // Final stage should be Feedback
    expect(result.current.currentStage).toBe(MissionStage.Feedback);
  });
});
