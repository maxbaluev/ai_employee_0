import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { POST } from './route';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

const DEFAULT_TENANT_ID = '7ae75a5c-0aed-4bd0-9c71-9d30e5bb6e08';

function createRequest(body: unknown): NextRequest {
  const request = new Request('http://localhost/api/inspect/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return request as NextRequest;
}

describe('POST /api/inspect/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const getSessionMock = vi.fn().mockResolvedValue({
      data: { session: { user: { id: DEFAULT_TENANT_ID } } },
      error: null,
    });

    const insertTelemetryMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const insertFindingMock = vi.fn().mockResolvedValue({
      data: {
        id: 'finding-123',
        tenant_id: DEFAULT_TENANT_ID,
        mission_id: '67ab22f9-0f06-4ac4-9710-4a1ddcb915d2',
        finding_type: 'coverage_gap',
        payload: { accountsMissingOwner: 12 },
        readiness: 92,
        created_at: '2025-10-11T00:00:00Z',
      },
      error: null,
    });

    const selectMock = vi.fn(() => ({ single: insertFindingMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));

    const fromMock = vi.fn((table: string) => {
      if (table === 'inspection_findings') {
        return { insert: insertMock };
      }
      if (table === 'mission_events') {
        return { insert: insertTelemetryMock };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: { getSession: getSessionMock },
      from: fromMock,
    } as unknown as Awaited<ReturnType<typeof getRouteHandlerSupabaseClientMock>>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when payload fails validation', async () => {
    const request = createRequest({});

    const response = await POST(request);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toHaveProperty('error');
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('returns 201 when inspection findings are persisted', async () => {
    const body = {
      missionId: '67ab22f9-0f06-4ac4-9710-4a1ddcb915d2',
      findingType: 'coverage_gap',
      readiness: 92,
      payload: { accountsMissingOwner: 12 },
    };

    const request = createRequest(body);

    const response = await POST(request);

    expect(response.status).toBe(201);
    const payload = await response.json();

    expect(getRouteHandlerSupabaseClientMock).toHaveBeenCalled();
    const supabaseClient = getRouteHandlerSupabaseClientMock.mock.results[0]?.value;
    await expect(supabaseClient).resolves.toBeDefined();

    expect(payload).toEqual({
      finding: expect.objectContaining({
        id: 'finding-123',
        mission_id: body.missionId,
        readiness: body.readiness,
      }),
    });
  });
});

