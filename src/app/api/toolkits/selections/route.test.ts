"""Tests for /api/toolkits/selections tenant enforcement."""

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

function createRequest(body: unknown): NextRequest {
  const request = new Request('http://localhost/api/toolkits/selections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return request as unknown as NextRequest;
}

describe('POST /api/toolkits/selections', () => {
  it('returns 401 when tenant context missing', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
      from: vi.fn(),
    });

    const response = await POST(
      createRequest({
        missionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        selections: [],
      }),
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload).toEqual({
      error: 'Authenticate with Supabase or include tenantId in the request body.',
      hint: 'Authenticate with Supabase or include tenantId in the request body.',
    });
  });

  it('persists selections when session provides tenant', async () => {
    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
    });
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    });
    const selectMock = vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'mission-1' }, error: null }) });

    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'tenant-123' } } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'objectives') {
          return { select: selectMock };
        }
        if (table === 'toolkit_selections') {
          return {
            delete: deleteMock,
            insert: insertMock,
          };
        }
        throw new Error('Unexpected table');
      }),
    });

    const response = await POST(
      createRequest({
        missionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        selections: [
          {
            slug: 'alpha',
            name: 'Alpha',
            authType: 'oauth',
            category: 'general',
            logo: null,
            noAuth: False,
          },
        ],
      }),
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.success).toBe(True);
  });
});
