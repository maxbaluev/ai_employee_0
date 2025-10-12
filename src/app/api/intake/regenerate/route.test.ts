/// <reference types="vitest" />

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const regenerateFieldMock = vi.hoisted(() => vi.fn());
const RegenerationLimitErrorMock = vi.hoisted(() => {
  return class RegenerationLimitError extends Error {
    constructor(
      public readonly field: 'objective' | 'audience' | 'kpis' | 'safeguards',
      public readonly limit: number = 3,
    ) {
      super(`Regeneration limit reached for ${field}`);
      this.name = 'RegenerationLimitError';
    }
  };
});
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/intake/service', () => ({
  regenerateField: regenerateFieldMock,
  RegenerationLimitError: RegenerationLimitErrorMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

const DEFAULT_SESSION_ID = 'tenant-123';
const DEFAULT_MISSION_ID = 'mission-abc-123';

function createRequest(body: unknown): NextRequest {
  const request = new Request('http://localhost/api/intake/regenerate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return request as unknown as NextRequest;
}

describe('POST /api/intake/regenerate', () => {
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

    regenerateFieldMock.mockResolvedValue({
      objective: 'Generated objective',
      audience: 'Generated audience',
      kpis: [],
      safeguardHints: [],
      confidence: 0.82,
      source: 'gemini',
    });
  });

  it('returns 429 on the fourth regeneration attempt for the same mission', async () => {
    const basePayload = {
      missionId: 'mission-429-limit',
      field: 'objective' as const,
    };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await POST(createRequest(basePayload));
      expect(response.status).toBe(200);
    }

    const fourthResponse = await POST(createRequest(basePayload));

    expect(fourthResponse.status).toBe(429);
    const payload = await fourthResponse.json();
    expect(payload).toEqual({
      error: 'Regeneration limit reached for objective. Please edit manually.',
      field: 'objective',
      limit: 3,
    });
    expect(regenerateFieldMock).toHaveBeenCalledTimes(3);
  });

  it('tracks regeneration limits separately per mission', async () => {
    const missionOnePayload = {
      missionId: 'mission-one',
      field: 'audience' as const,
    };

    const missionTwoPayload = {
      missionId: 'mission-two',
      field: 'audience' as const,
    };

    // Exhaust limit for mission one
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await POST(createRequest(missionOnePayload));
      expect(response.status).toBe(200);
    }

    // Mission one should now be blocked
    const blockedResponse = await POST(createRequest(missionOnePayload));
    expect(blockedResponse.status).toBe(429);

    // Mission two should still be allowed
    const missionTwoResponse = await POST(createRequest(missionTwoPayload));
    expect(missionTwoResponse.status).toBe(200);
    expect(regenerateFieldMock).toHaveBeenCalledTimes(4);
  });
});
