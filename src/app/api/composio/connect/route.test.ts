import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const logTelemetryEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/lib/intake/service', () => ({
  logTelemetryEvent: logTelemetryEventMock,
}));

type RequestBody = Record<string, unknown>;

function createRequest(body: RequestBody): NextRequest {
  const request = new Request('http://localhost/api/composio/connect', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

  return request as unknown as NextRequest;
}

describe('POST /api/composio/connect', () => {
  const originalApiKey = process.env.COMPOSIO_API_KEY;
  const originalTokenKey = process.env.COMPOSIO_TOKEN_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.COMPOSIO_API_KEY = 'composio-api-key';
    process.env.COMPOSIO_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

    vi.clearAllMocks();
    logTelemetryEventMock.mockResolvedValue(undefined);

    const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: 'token-123' }, error: null });
    const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });

    getServiceSupabaseClientMock.mockReturnValue({
      from: fromMock,
    } as unknown as Record<string, unknown>);
  });

  it('returns 400 when payload fails validation', async () => {
    const request = createRequest({});

    const response = await POST(request);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toHaveProperty('error', 'Invalid payload');
  });

  it('initiates OAuth session and returns authorization url', async () => {
    const request = createRequest({
      mode: 'init',
      tenantId: '8e53be5c-4786-43b6-8252-9871cb141547',
      missionId: 'ebaf9a0a-958b-4cad-a723-7f2b29a7f467',
      redirectUri: 'https://control-plane.dev/api/composio/connect',
      provider: 'composio',
      scopes: ['connections:read'],
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toHaveProperty('authorizationUrl');
    expect(typeof payload.authorizationUrl).toBe('string');
    expect(payload).toHaveProperty('state');
  });

  it('persists tokens during callback handshake', async () => {
    const tenantId = '93aefb77-8a6c-4a07-b6ad-28565c87b628';
    const missionId = 'f8fb21fe-6b9e-42c6-96bb-3f2297e5b1f2';

    const initResponse = await POST(
      createRequest({
        mode: 'init',
        tenantId,
        missionId,
        redirectUri: 'https://control-plane.dev/api/composio/connect',
        provider: 'composio',
      }),
    );

    const initPayload = await initResponse.json();

    const callbackResponse = await POST(
      createRequest({
        mode: 'callback',
        tenantId,
        missionId,
        provider: 'composio',
        code: 'code-123',
        state: initPayload.state,
        redirectUri: 'https://control-plane.dev/api/composio/connect',
      }),
    );

    const callbackPayload = await callbackResponse.json();

    expect(callbackResponse.status).toBe(200);

    const supabaseClient = getServiceSupabaseClientMock.mock.results.at(-1)?.value as {
      from: ReturnType<typeof vi.fn>;
    };

    const fromMock = supabaseClient.from as unknown as vi.Mock;
    expect(fromMock).toHaveBeenCalledWith('oauth_tokens');

    const upsertMock = (fromMock.mock.results[0]?.value as { upsert: vi.Mock }).upsert;
    expect(upsertMock).toHaveBeenCalled();

    expect(logTelemetryEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'composio_oauth_connected',
        tenantId,
      }),
    );
  });

  afterEach(() => {
    process.env.COMPOSIO_API_KEY = originalApiKey;
    process.env.COMPOSIO_TOKEN_ENCRYPTION_KEY = originalTokenKey;
  });
});
