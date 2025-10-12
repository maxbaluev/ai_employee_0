/// <reference types="vitest" />

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const generateIntakeMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/intake/service', () => ({
  generateIntake: generateIntakeMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

function createRequest(body: unknown): NextRequest {
  const request = new Request('http://localhost/api/intake/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return request as unknown as NextRequest;
}

describe('POST /api/intake/generate', () => {
  it('returns 401 when tenant context missing', async () => {
    vi.clearAllMocks();

    // Mock Supabase session to null
    const getSessionMock = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });

    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getSession: getSessionMock,
      },
    } as unknown as Record<string, unknown>);

    const request = createRequest({
      rawText: 'Test mission input',
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload).toEqual({
      error: 'Unable to determine tenant context',
      hint: 'Authenticate with Supabase or supply tenantId in the request body',
    });
    expect(generateIntakeMock).not.toHaveBeenCalled();
  });

  it('returns 200 when session provides tenant', async () => {
    vi.clearAllMocks();

    const tenantId = 'tenant-123';
    const mockMissionId = 'mission-abc-123';
    const mockChips = [
      { field: 'objective', value: 'Test objective' },
      { field: 'audience', value: 'Test audience' },
    ];

    // Mock Supabase session with user id
    const getSessionMock = vi.fn().mockResolvedValue({
      data: {
        session: {
          user: { id: tenantId },
        },
      },
      error: null,
    });

    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getSession: getSessionMock,
      },
    } as unknown as Record<string, unknown>);

    // Mock generateIntake to return known mission/chips
    generateIntakeMock.mockResolvedValue({
      missionId: mockMissionId,
      chips: mockChips,
    });

    const request = createRequest({
      rawText: 'Test mission input',
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      missionId: mockMissionId,
      chips: mockChips,
    });

    expect(generateIntakeMock).toHaveBeenCalledWith({
      rawText: 'Test mission input',
      links: undefined,
      tenantId,
      missionId: undefined,
    });
  });
});
