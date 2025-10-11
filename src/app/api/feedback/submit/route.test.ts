import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const persistMissionFeedbackMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/feedback/service', () => ({
  persistMissionFeedback: persistMissionFeedbackMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

const DEFAULT_SESSION_ID = 'user-tenant-123';

function createRequest(body: unknown): NextRequest {
  const request = new Request('http://localhost/api/feedback/submit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

  return request as unknown as NextRequest;
}

describe('POST /api/feedback/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const getSessionMock = vi.fn().mockResolvedValue({
      data: { session: { user: { id: DEFAULT_SESSION_ID } } },
      error: null,
    });

    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getSession: getSessionMock,
      },
    } as unknown as Record<string, unknown>);

    persistMissionFeedbackMock.mockResolvedValue({
      id: 'feedback-123',
      missionId: 'mission-abc',
      tenantId: DEFAULT_SESSION_ID,
      artifactId: null,
      rating: 5,
      feedbackText: 'Great work',
      learningSignals: {},
      createdAt: '2025-10-11T00:00:00Z',
      updatedAt: '2025-10-11T00:00:00Z',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 with validation errors when payload fails Zod schema', async () => {
    const request = createRequest({});

    const response = await POST(request);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toHaveProperty('error', 'Invalid feedback payload');
    expect(persistMissionFeedbackMock).not.toHaveBeenCalled();
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('persists mission feedback and returns 201 on success', async () => {
    const body = {
      missionId: '02c7f38d-e161-43e1-b16b-924058e23f4f',
      rating: 4,
      feedbackText: 'Solid iteration with minor gaps',
      learningSignals: { tone: 'casual' },
    };

    const request = createRequest(body);

    const response = await POST(request);

    expect(response.status).toBe(201);
    const payload = await response.json();

    expect(persistMissionFeedbackMock).toHaveBeenCalledWith({
      tenantId: DEFAULT_SESSION_ID,
      missionId: body.missionId,
      artifactId: undefined,
      rating: body.rating,
      feedbackText: body.feedbackText,
      learningSignals: body.learningSignals,
    });

    expect(payload).toEqual({
      feedback: expect.objectContaining({
        id: 'feedback-123',
        missionId: 'mission-abc',
        tenantId: DEFAULT_SESSION_ID,
      }),
    });
  });
});
