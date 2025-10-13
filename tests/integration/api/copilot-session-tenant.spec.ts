import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { GET, POST } from '@/app/api/copilotkit/session/route';

const BASE_URL = 'https://example.com/api/copilotkit/session';

const buildJsonRequest = (method: 'GET' | 'POST', body?: unknown) => {
  if (method === 'GET') {
    return new NextRequest(`${BASE_URL}?sessionIdentifier=test-session`, { method });
  }

  return new NextRequest(BASE_URL, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'content-type': 'application/json',
    },
  });
};

describe('CopilotKit session tenant enforcement', () => {
  it('rejects POST requests without a tenant', async () => {
    const request = buildJsonRequest('POST', {
      agentId: 'control_plane_foundation',
      sessionIdentifier: 'fallback-check',
      state: {},
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(400);

    const payload = (await response.json()) as { error?: string; details?: { fieldErrors?: Record<string, unknown> } };
    expect(payload.error).toEqual('Invalid Copilot session query');
    expect(payload.details?.fieldErrors?.tenantId).toBeDefined();
  });

  it('rejects GET requests without a tenant', async () => {
    const request = buildJsonRequest('GET');

    const response = await GET(request as NextRequest);
    expect(response.status).toBe(400);

    const payload = (await response.json()) as { hint?: string };
    expect(payload.hint).toMatch(/tenant/i);
  });
});
