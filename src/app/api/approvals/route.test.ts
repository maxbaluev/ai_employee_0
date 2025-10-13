// Tests for tenant enforcement on /api/approvals.

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

function createRequest(body: unknown): NextRequest {
  const request = new Request('http://localhost/api/approvals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return request as unknown as NextRequest;
}

describe('POST /api/approvals', () => {
  it('returns 401 when tenant context missing', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const selectChain = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock }),
      }),
    };

    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn(),
        insert: vi.fn(),
      }),
    });

    const response = await POST(
      createRequest({
        toolCallId: '6ef239ba-2357-4438-9a72-1bf8f3dcd82f',
        decision: 'approved',
      }),
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload).toEqual({
      error: 'Unable to determine tenant context',
      hint: 'Authenticate with Supabase or include tenantId in the request body',
    });
  });

  it('persists approval when tenant supplied', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const selectChain = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock }),
      }),
    };

    const updateMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
    });

    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(selectChain),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'approval-1',
              mission_id: 'mission-1',
              decision: 'approved',
            },
            error: null,
          }) }),
        }),
        update: updateMock,
      }),
    });

    const response = await POST(
      createRequest({
        tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        missionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        toolCallId: '6ef239ba-2357-4438-9a72-1bf8f3dcd82f',
        decision: 'approved',
      }),
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.approval.decision).toBe('approved');
  });
});
