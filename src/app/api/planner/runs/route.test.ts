/// <reference types="vitest" />

import { NextRequest } from 'next/server';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

describe('GET /api/planner/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when tenantId is missing', async () => {
    const request = new NextRequest('https://example.com/api/planner/runs');

    const { GET } = await import('./route');

    const response = await GET(request);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toMatchObject({
      error: expect.stringContaining('tenantId'),
    });
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('returns recent planner runs ordered by created_at desc', async () => {
    const rows = [
      {
        id: 'run-2',
        tenant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        mission_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        latency_ms: 2100,
        candidate_count: 3,
        embedding_similarity_avg: 0.61,
        primary_toolkits: ['hubspot', 'gmail'],
        mode: 'dry_run',
        created_at: '2025-10-11T08:01:00.000Z',
      },
      {
        id: 'run-1',
        tenant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        mission_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        latency_ms: 2575,
        candidate_count: 4,
        embedding_similarity_avg: 0.57,
        primary_toolkits: ['salesforce'],
        mode: 'dry_run',
        created_at: '2025-10-11T07:59:00.000Z',
      },
    ];

    const limitMock = vi.fn().mockResolvedValue({ data: rows, error: null });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqMissionMock = vi.fn().mockReturnValue({ order: orderMock });
    const eqTenantMock = vi.fn().mockReturnValue({ eq: eqMissionMock, order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqTenantMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });

    getServiceSupabaseClientMock.mockReturnValue({
      from: fromMock,
    });

    const params = new URLSearchParams({
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      missionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      limit: '5',
    });

    const request = new NextRequest(`https://example.com/api/planner/runs?${params.toString()}`);

    const { GET } = await import('./route');

    const response = await GET(request);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ runs: rows });

    expect(getServiceSupabaseClientMock).toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith('planner_runs');
    expect(selectMock).toHaveBeenCalledWith(
      'id, tenant_id, mission_id, latency_ms, candidate_count, embedding_similarity_avg, primary_toolkits, mode, metadata, created_at',
    );
    expect(eqTenantMock).toHaveBeenCalledWith('tenant_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(eqMissionMock).toHaveBeenCalledWith('mission_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(5);
  });
});
