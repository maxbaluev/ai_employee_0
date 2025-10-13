import { createCipheriv, createHash, randomBytes, randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logTelemetryEvent } from '@/lib/intake/service';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

type InitPayload = {
  mode: 'init';
  tenantId?: string | null;
  missionId?: string | null;
  redirectUri: string;
  provider: string;
  scopes?: string[];
  toolkitSlug?: string | null;
};

type CallbackPayload = {
  mode: 'callback';
  tenantId?: string | null;
  missionId?: string | null;
  provider: string;
  code: string;
  state: string;
  redirectUri: string;
  codeVerifier?: string;
  toolkitSlug?: string | null;
};

type Payload = InitPayload | CallbackPayload;

type StatePayload = {
  tenantId: string;
  missionId?: string | null;
  scopes: string[];
  toolkit?: string | null;
  nonce: string;
  issuedAt: string;
};

type SupabaseInsertPayload = {
  tenant_id: string;
  provider: string;
  connection_id: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_fingerprint: string;
  expires_at: string | null;
  scope: string[];
  metadata: Record<string, unknown>;
};

type SupabaseInsertResult = {
  id: string;
};

type ComposioInitResponse = {
  authorizationUrl: string;
  state: string;
  expiresAt: Date;
};

type ComposioTokenResponse = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes: string[];
  connectionId: string;
  metadata?: Record<string, unknown>;
};

const payloadSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('init'),
    tenantId: z.string().uuid(),
    missionId: z.string().uuid().optional(),
    redirectUri: z.string().url(),
    provider: z.string().min(1).default('composio'),
    scopes: z.array(z.string().min(1).max(128)).max(40).optional(),
    toolkitSlug: z.string().min(1).optional(),
  }),
  z.object({
    mode: z.literal('callback'),
    tenantId: z.string().uuid(),
    missionId: z.string().uuid().optional(),
    provider: z.string().min(1).default('composio'),
    code: z.string().min(1),
    state: z.string().min(1),
    redirectUri: z.string().url(),
    codeVerifier: z.string().min(32).max(128).optional(),
    toolkitSlug: z.string().min(1).optional(),
  }),
]);

const DEFAULT_SCOPES = ['connections:read'];

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid payload',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = parsed.data as Payload;

  const tenantId = payload.tenantId;

  if (!tenantId) {
    return NextResponse.json(
      {
        error: 'Missing tenant context',
        hint: 'tenantId (UUID) is required in the request payload',
      },
      { status: 400 },
    );
  }

  const composioApiKey = process.env.COMPOSIO_API_KEY;
  const composioAuthUrl = process.env.COMPOSIO_AUTH_URL ?? 'https://app.composio.dev/oauth/authorize';
  const tokenSecret = process.env.COMPOSIO_TOKEN_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY;
  const encryptionKey = tokenSecret ? createHash('sha256').update(tokenSecret).digest() : null;

  if (!composioApiKey) {
    return NextResponse.json(
      {
        error: 'Composio API key not configured',
        hint: 'Set COMPOSIO_API_KEY before initiating OAuth handshake',
      },
      { status: 500 },
    );
  }

  if (payload.mode === 'callback' && !encryptionKey) {
    return NextResponse.json(
      {
        error: 'Token encryption secret missing',
        hint: 'Set COMPOSIO_TOKEN_ENCRYPTION_KEY or ENCRYPTION_KEY',
      },
      { status: 500 },
    );
  }

  const supabase = getServiceSupabaseClient();

  if (payload.mode === 'init') {
    const scopes = payload.scopes && payload.scopes.length > 0 ? payload.scopes : DEFAULT_SCOPES;
    const state = encodeState({
      tenantId,
      missionId: payload.missionId ?? null,
      scopes,
      toolkit: payload.toolkitSlug ?? null,
      nonce: randomBytes(8).toString('hex'),
      issuedAt: new Date().toISOString(),
    });

    try {
      const session = await createPlaceholderComposioClient({
        apiKey: composioApiKey,
        authUrl: composioAuthUrl,
      }).createAuthorizationSession({
        redirectUri: payload.redirectUri,
        state,
        scopes,
        tenantId,
      });

      if (payload.toolkitSlug && payload.missionId) {
        try {
          const placeholderConnectionId = `pending:${session.state}`;
          await supabase
            .from('toolkit_connections')
            .upsert(
              {
                tenant_id: tenantId,
                mission_id: payload.missionId,
                toolkit: payload.toolkitSlug,
                connection_id: placeholderConnectionId,
                status: 'pending',
                auth_mode: payload.scopes?.length ? 'oauth' : null,
                metadata: {
                  redirect_uri: payload.redirectUri,
                  scopes,
                  state: session.state,
                  initiated_at: new Date().toISOString(),
                },
              } as never,
              { onConflict: 'tenant_id,mission_id,toolkit' },
            );

          await supabase
            .from('toolkit_selections')
            .update({ connection_status: 'pending' })
            .eq('tenant_id', tenantId)
            .eq('mission_id', payload.missionId)
            .eq('toolkit_id', payload.toolkitSlug);
        } catch (statusError) {
          console.warn('[api:composio-connect] failed to seed connection status', statusError);
        }
      }

      try {
        await logTelemetryEvent({
          tenantId,
          missionId: payload.missionId ?? undefined,
          eventName: 'composio_oauth_initiated',
          eventData: {
            provider: payload.provider,
            scopes,
            state,
          },
        });
      } catch (telemetryError) {
        console.warn('[api:composio-connect] telemetry failed', telemetryError);
      }

      if (payload.toolkitSlug) {
        try {
          await logTelemetryEvent({
            tenantId,
            missionId: payload.missionId ?? undefined,
            eventName: 'connect_link_launched',
            eventData: {
              toolkit_slug: payload.toolkitSlug,
              scopes,
              state,
            },
          });
        } catch (telemetryError) {
          console.warn('[api:composio-connect] connect_link telemetry failed', telemetryError);
        }
      }

      return NextResponse.json({
        authorizationUrl: session.authorizationUrl,
        state: session.state,
        expiresAt: session.expiresAt.toISOString(),
      });
    } catch (error) {
      console.error('[api:composio-connect] Failed to initialise OAuth session', error);
      return NextResponse.json(
        {
          error: 'Failed to initiate Composio OAuth handshake',
          hint: error instanceof Error ? error.message : 'Unexpected error',
        },
        { status: 502 },
      );
    }
  }

  const decodedState = decodeState(payload.state);
  if (!decodedState) {
    return NextResponse.json(
      {
        error: 'Invalid OAuth state payload',
        hint: 'State did not decode from base64url',
      },
      { status: 400 },
    );
  }

  const resolvedTenant = decodedState.tenantId ?? tenantId;
  const scopes = decodedState.scopes?.length ? decodedState.scopes : DEFAULT_SCOPES;

  try {
    const tokenResponse = await createPlaceholderComposioClient({
      apiKey: composioApiKey,
      authUrl: composioAuthUrl,
    }).exchangeCode({
      code: payload.code,
      redirectUri: payload.redirectUri,
      codeVerifier: payload.codeVerifier,
      state: payload.state,
      scopes,
    });

    const encryptedAccess = encryptionKey
      ? encryptToken(tokenResponse.accessToken, encryptionKey)
      : tokenResponse.accessToken;
    const encryptedRefresh = tokenResponse.refreshToken
      ? encryptionKey
        ? encryptToken(tokenResponse.refreshToken, encryptionKey)
        : tokenResponse.refreshToken
      : null;

    const insertPayload: SupabaseInsertPayload = {
      tenant_id: resolvedTenant,
      provider: payload.provider,
      connection_id: tokenResponse.connectionId,
      access_token_ciphertext: encryptedAccess,
      refresh_token_ciphertext: encryptedRefresh,
      token_fingerprint: fingerprintToken(tokenResponse.accessToken),
      expires_at: tokenResponse.expiresAt ? tokenResponse.expiresAt.toISOString() : null,
      scope: tokenResponse.scopes,
      metadata: {
        state: payload.state,
        mission_id: decodedState.missionId ?? payload.missionId ?? null,
        placeholder: true,
        provider_metadata: tokenResponse.metadata ?? {},
      },
    };

    const { data, error } = await supabase
      .from('oauth_tokens')
      .upsert(insertPayload as never, { onConflict: 'tenant_id,provider,connection_id' })
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    const inserted = data as SupabaseInsertResult | null;

    const missionForConnection = decodedState.missionId ?? payload.missionId ?? null;
    const toolkitSlug = decodedState.toolkit ?? payload.toolkitSlug ?? null;

    if (toolkitSlug && missionForConnection) {
      try {
        await supabase
          .from('toolkit_connections')
          .upsert(
            {
              tenant_id: resolvedTenant,
              mission_id: missionForConnection,
              toolkit: toolkitSlug,
              connection_id: tokenResponse.connectionId,
              status: 'linked',
              auth_mode: tokenResponse.metadata && typeof tokenResponse.metadata === 'object'
                ? ((tokenResponse.metadata as Record<string, unknown>).auth_mode as string | null) ?? 'oauth'
                : 'oauth',
              metadata: {
                ...(tokenResponse.metadata ?? {}),
                scopes,
                connected_at: new Date().toISOString(),
              },
            } as never,
            { onConflict: 'tenant_id,mission_id,toolkit' },
          );

        await supabase
          .from('toolkit_selections')
          .update({ connection_status: 'linked' })
          .eq('tenant_id', resolvedTenant)
          .eq('mission_id', missionForConnection)
          .eq('toolkit_id', toolkitSlug);
      } catch (statusError) {
        console.warn('[api:composio-connect] failed to update connect link status', statusError);
      }
    }

    try {
      await logTelemetryEvent({
        tenantId: resolvedTenant,
        missionId: decodedState.missionId ?? payload.missionId ?? undefined,
        eventName: 'composio_oauth_connected',
        eventData: {
          provider: payload.provider,
          connectionId: tokenResponse.connectionId,
          tokenId: inserted?.id ?? null,
          scopes,
        },
      });
    } catch (telemetryError) {
      console.warn('[api:composio-connect] telemetry failed', telemetryError);
    }

    if (toolkitSlug) {
      try {
        await logTelemetryEvent({
          tenantId: resolvedTenant,
          missionId: decodedState.missionId ?? payload.missionId ?? undefined,
          eventName: 'connect_link_completed',
          eventData: {
            toolkit_slug: toolkitSlug,
            connection_id: tokenResponse.connectionId,
            token_id: inserted?.id ?? null,
          },
        });
      } catch (telemetryError) {
        console.warn('[api:composio-connect] connect_link completion telemetry failed', telemetryError);
      }
    }

    return NextResponse.json({
      provider: payload.provider,
      connectionId: tokenResponse.connectionId,
      missionId: decodedState.missionId ?? payload.missionId ?? null,
      tokenId: inserted?.id ?? null,
    });
  } catch (error) {
    console.error('[api:composio-connect] OAuth callback failed', error);

    try {
      await logTelemetryEvent({
        tenantId: resolvedTenant ?? tenantId,
        missionId: decodedState?.missionId ?? payload.missionId ?? undefined,
        eventName: 'connect_link_failed',
        eventData: {
          toolkit_slug: decodedState?.toolkit ?? payload.toolkitSlug ?? null,
          hint: error instanceof Error ? error.message : 'Unexpected error',
        },
      });
    } catch (telemetryError) {
      console.warn('[api:composio-connect] connect_link failure telemetry failed', telemetryError);
    }

    return NextResponse.json(
      {
        error: 'Failed to exchange Composio authorization code',
        hint: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 502 },
    );
  }
}

function createPlaceholderComposioClient(config: { apiKey: string; authUrl: string }) {
  return new PlaceholderComposioClient(config);
}

class PlaceholderComposioClient {
  constructor(private readonly config: { apiKey: string; authUrl: string }) {}

  async createAuthorizationSession(params: {
    redirectUri: string;
    state: string;
    scopes: string[];
    tenantId: string;
  }): Promise<ComposioInitResponse> {
    if (!this.config.apiKey) {
      throw new Error('COMPOSIO_API_KEY not configured');
    }

    const scopeParam = encodeURIComponent(params.scopes.join(' '));
    const authorizationUrl = `${this.config.authUrl}?state=${encodeURIComponent(params.state)}&redirect_uri=${encodeURIComponent(params.redirectUri)}&client_id=${encodeURIComponent(this.config.apiKey)}&response_type=code&scope=${scopeParam}`;

    return {
      authorizationUrl,
      state: params.state,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
  }

  async exchangeCode(params: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
    state: string;
    scopes: string[];
  }): Promise<ComposioTokenResponse> {
    if (!this.config.apiKey) {
      throw new Error('COMPOSIO_API_KEY not configured');
    }

    if (!params.code) {
      throw new Error('Missing authorization code for exchange');
    }

    return {
      accessToken: toBase64Url(randomBytes(48)),
      refreshToken: toBase64Url(randomBytes(48)),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      scopes: params.scopes,
      connectionId: randomUUID(),
      metadata: {
        placeholder: true,
        redirectUri: params.redirectUri,
        state: params.state,
        pkce: Boolean(params.codeVerifier),
      },
    };
  }
}

function encryptToken(token: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return toBase64Url(Buffer.concat([iv, authTag, ciphertext]));
}

function fingerprintToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function encodeState(payload: StatePayload): string {
  const json = JSON.stringify(payload);
  return toBase64Url(Buffer.from(json, 'utf8'));
}

function decodeState(state: string): StatePayload | null {
  try {
    const json = fromBase64Url(state).toString('utf8');
    const parsed = JSON.parse(json) as Partial<StatePayload>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.tenantId !== 'string') {
      return null;
    }
    return {
      tenantId: parsed.tenantId,
      missionId: parsed.missionId ?? null,
      scopes: Array.isArray(parsed.scopes) && parsed.scopes.every((value) => typeof value === 'string')
        ? (parsed.scopes as string[])
        : DEFAULT_SCOPES,
      toolkit: typeof parsed.toolkit === 'string' ? parsed.toolkit : null,
      nonce: typeof parsed.nonce === 'string' ? parsed.nonce : '',
      issuedAt: typeof parsed.issuedAt === 'string' ? parsed.issuedAt : new Date().toISOString(),
    };
  } catch (error) {
    console.warn('[api:composio-connect] Failed to decode state', error);
    return null;
  }
}

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
}
