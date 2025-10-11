import { beforeEach, describe, expect, it, vi } from 'vitest';

import { persistMissionFeedback } from './service';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

describe('persistMissionFeedback', () => {
  const baseParams = {
    tenantId: 'tenant-123',
    missionId: 'mission-abc',
    artifactId: 'artifact-xyz',
    rating: 5,
    feedbackText: 'Great work',
    learningSignals: { tone: 'casual' },
  } as const;

  let singleMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let insertFeedbackMock: ReturnType<typeof vi.fn>;
  let insertTelemetryMock: ReturnType<typeof vi.fn>;
  let fromMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    singleMock = vi.fn();
    selectMock = vi.fn(() => ({ single: singleMock }));
    insertFeedbackMock = vi.fn(() => ({ select: selectMock }));
    insertTelemetryMock = vi.fn().mockResolvedValue({ data: null, error: null });

    fromMock = vi.fn((table: string) => {
      if (table === 'mission_feedback') {
        return {
          insert: insertFeedbackMock,
        };
      }

      if (table === 'mission_events') {
        return {
          insert: insertTelemetryMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    getServiceSupabaseClientMock.mockReturnValue({
      from: fromMock,
    } as unknown as Record<string, unknown>);
  });

  it('inserts feedback row, emits telemetry, and returns normalized result', async () => {
    const supabaseRow = {
      id: 'feedback-123',
      mission_id: baseParams.missionId,
      tenant_id: baseParams.tenantId,
      artifact_id: baseParams.artifactId,
      rating: baseParams.rating,
      feedback_text: baseParams.feedbackText,
      learning_signals: baseParams.learningSignals,
      created_at: '2025-10-11T00:00:00Z',
      updated_at: '2025-10-11T00:00:00Z',
    };

    singleMock.mockResolvedValue({ data: supabaseRow, error: null });

    const result = await persistMissionFeedback({ ...baseParams });

    expect(insertFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mission_id: baseParams.missionId,
        tenant_id: baseParams.tenantId,
        artifact_id: baseParams.artifactId,
        rating: baseParams.rating,
        feedback_text: baseParams.feedbackText,
      }),
    );

    expect(selectMock).toHaveBeenCalledWith(
      'id, mission_id, tenant_id, artifact_id, rating, feedback_text, learning_signals, created_at, updated_at',
    );

    expect(insertTelemetryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: baseParams.tenantId,
        mission_id: baseParams.missionId,
        event_name: 'mission_feedback_submitted',
        event_payload: expect.objectContaining({
          rating: baseParams.rating,
          has_artifact_id: true,
          text_length: baseParams.feedbackText.length,
        }),
      }),
    );

    expect(result).toEqual({
      id: 'feedback-123',
      missionId: baseParams.missionId,
      tenantId: baseParams.tenantId,
      artifactId: baseParams.artifactId,
      rating: baseParams.rating,
      feedbackText: baseParams.feedbackText,
      learningSignals: baseParams.learningSignals,
      createdAt: '2025-10-11T00:00:00Z',
      updatedAt: '2025-10-11T00:00:00Z',
    });
  });

  it('throws an error when Supabase returns a failure response', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

    await expect(persistMissionFeedback({ ...baseParams })).rejects.toThrow(
      'insert failed',
    );

    expect(insertTelemetryMock).not.toHaveBeenCalled();
  });
});
