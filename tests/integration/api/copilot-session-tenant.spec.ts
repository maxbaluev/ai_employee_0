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

// TODO(Gate G-B): Enable this suite once `/api/copilotkit/session` requires an explicit tenant identifier.
describe.skip('CopilotKit session fallback guard', () => {
  it('rejects POST requests without a tenant', async () => {
    const request = buildJsonRequest('POST', {
      agentId: 'control_plane_foundation',
      sessionIdentifier: 'fallback-check',
      state: {},
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(400);

    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toMatch(/tenant/i);
  });

  it('rejects GET requests without a tenant', async () => {
    const request = buildJsonRequest('GET');

    const response = await GET(request as NextRequest);
    expect(response.status).toBe(400);

    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toMatch(/tenant/i);
  });
});
