import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET, __resetToolkitRecommendationLimiter } from './route';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const fetchToolkitRecommendationsMock = vi.hoisted(() => vi.fn());
const logTelemetryEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/lib/toolkits/recommendation', () => ({
  fetchToolkitRecommendations: fetchToolkitRecommendationsMock,
}));

vi.mock('@/lib/intake/service', () => ({
  logTelemetryEvent: logTelemetryEventMock,
}));

function createNextRequest(url: string): NextRequest {
  const request = new Request(url);
  const nextRequest = request as unknown as NextRequest & { nextUrl?: URL };
  nextRequest.nextUrl = new URL(url);
  return nextRequest as NextRequest;
}

describe('GET /api/toolkits/recommend', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await __resetToolkitRecommendationLimiter();

    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'tenant-session-id' } } }, error: null }),
      },
    });

    logTelemetryEventMock.mockResolvedValue(undefined);
  });

  it('returns 401 when tenant context is missing', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    });

    const response = await GET(createNextRequest('http://localhost/api/toolkits/recommend'));

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload).toMatchObject({ error: 'Unable to determine tenant context' });
    expect(fetchToolkitRecommendationsMock).not.toHaveBeenCalled();
  });

  it('returns recommendations and emits telemetry', async () => {
    fetchToolkitRecommendationsMock.mockResolvedValue({
      toolkits: [{ slug: 'github', name: 'GitHub', suggestedByPlanner: true }],
      selectionDetails: [],
      plannerSuggestion: null,
      requestId: 'abc123',
    });

    const response = await GET(
      createNextRequest(
        'http://localhost/api/toolkits/recommend?tenantId=4b2c4b1c-17fb-4a23-8f51-5a29ff6f7e1a&missionId=b7d7a5ce-094b-4f7f-93fb-1f87e8ebf51d&persona=growth&industry=saas',
      ),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.toolkits).toHaveLength(1);
    expect(fetchToolkitRecommendationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '4b2c4b1c-17fb-4a23-8f51-5a29ff6f7e1a', missionId: 'b7d7a5ce-094b-4f7f-93fb-1f87e8ebf51d' }),
    );
    expect(logTelemetryEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '4b2c4b1c-17fb-4a23-8f51-5a29ff6f7e1a',
        missionId: 'b7d7a5ce-094b-4f7f-93fb-1f87e8ebf51d',
        eventName: 'api_toolkits_recommend_hit',
      }),
    );
  });

  it('returns 429 when rate limit exceeded for a mission', async () => {
    fetchToolkitRecommendationsMock.mockResolvedValue({
      toolkits: [],
      selectionDetails: [],
      plannerSuggestion: null,
      requestId: 'rate-limit-test',
    });

    const url =
      'http://localhost/api/toolkits/recommend?tenantId=4b2c4b1c-17fb-4a23-8f51-5a29ff6f7e1a&missionId=2d3d75f6-3c8e-45f6-934f-dce12bf7ac11';

    for (let i = 0; i < 5; i += 1) {
      const response = await GET(createNextRequest(url));
      expect(response.status).toBe(200);
    }

    const limitedResponse = await GET(createNextRequest(url));

    expect(limitedResponse.status).toBe(429);
    expect(fetchToolkitRecommendationsMock).toHaveBeenCalledTimes(5);
  });

  it('swallows telemetry failures', async () => {
    logTelemetryEventMock.mockRejectedValue(new Error('telemetry offline'));
    fetchToolkitRecommendationsMock.mockResolvedValue({
      toolkits: [],
      selectionDetails: [],
      plannerSuggestion: null,
      requestId: 'telemetry',
    });

    const response = await GET(
      createNextRequest('http://localhost/api/toolkits/recommend?tenantId=4e95458b-7c66-4eac-97ba-3f22265f5568'),
    );

    expect(response.status).toBe(200);
  });

  it('returns 500 when recommendation helper throws', async () => {
    fetchToolkitRecommendationsMock.mockRejectedValue(new Error('network failure'));

    const response = await GET(
      createNextRequest('http://localhost/api/toolkits/recommend?tenantId=4e95458b-7c66-4eac-97ba-3f22265f5568'),
    );

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toEqual({ error: 'Failed to load toolkit recommendations' });
  });
});

