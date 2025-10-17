import { NextResponse } from "next/server";
import { z } from "zod";

import { intakeRateLimiter } from "@/lib/server/rate-limiter";
import { getServiceSupabaseClient } from "@/lib/server/supabase";
import { emitServerTelemetry } from "@/lib/telemetry/server";

const hintsSchema = z
  .object({
    objective: z.string().trim().optional(),
    audience: z.string().trim().optional(),
    kpi: z.string().trim().optional(),
    timeline: z.string().trim().optional(),
    summary: z.string().trim().optional(),
  })
  .partial()
  .optional();

const payloadSchema = z.object({
  missionId: z.string().uuid("missionId must be a valid UUID"),
  intent: z.string().min(8, "intent must contain at least 8 characters"),
  hints: hintsSchema,
});

const backendResponseSchema = z.object({
  mission_brief: z.record(z.string(), z.unknown()).default({}),
  confidence_scores: z.record(z.string(), z.number()).default({}),
  safeguards: z.array(z.record(z.string(), z.unknown())).default([]),
  generation_latency_ms: z.number().optional(),
});

type ParsedPayload = z.infer<typeof payloadSchema>;

type BackendResponse = z.infer<typeof backendResponseSchema>;

const DEFAULT_AGENT_URL = "http://localhost:8000";

function createIncidentId() {
  return globalThis.crypto?.randomUUID() ?? `${Date.now()}-${Math.random()}`;
}

function jsonError(
  status: number,
  error: string,
  message: string,
  incidentId: string,
  details?: Record<string, unknown>,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    {
      error,
      message,
      incident_id: incidentId,
      ...(details ?? {}),
    },
    { status, headers },
  );
}

async function parsePayload(request: Request, incidentId: string) {
  let json: unknown;

  try {
    json = await request.json();
  } catch (error) {
    return {
      error: jsonError(
        400,
        "invalid_json",
        "Request body must be valid JSON",
        incidentId,
      ),
    } as const;
  }

  try {
    return { payload: payloadSchema.parse(json) } as const;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: jsonError(
          400,
          "invalid_request",
          "Invalid intake payload",
          incidentId,
          { details: error.issues },
        ),
      } as const;
    }

    return {
      error: jsonError(
        400,
        "invalid_request",
        "Unable to parse intake payload",
        incidentId,
      ),
    } as const;
  }
}

type AuthContext = {
  token: string;
  userId: string;
  tenantId: string;
};

async function authenticateRequest(
  request: Request,
  incidentId: string,
): Promise<{ context?: AuthContext; error?: NextResponse }> {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return {
      error: jsonError(
        401,
        "unauthorized",
        "Missing Authorization header",
        incidentId,
      ),
    };
  }

  const match = /^bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) {
    return {
      error: jsonError(
        401,
        "unauthorized",
        "Authorization header must be a Bearer token",
        incidentId,
      ),
    };
  }

  const token = match[1];

  try {
    const client = getServiceSupabaseClient();
    const { data, error } = await client.auth.getUser(token);

    if (error || !data?.user) {
      return {
        error: jsonError(
          401,
          "unauthorized",
          "Invalid or expired Supabase token",
          incidentId,
        ),
      };
    }

    const tenantId =
      (data.user.user_metadata as Record<string, unknown> | undefined)?.tenantId ||
      (data.user.app_metadata as Record<string, unknown> | undefined)?.tenantId;

    if (!tenantId || typeof tenantId !== "string") {
      return {
        error: jsonError(
          403,
          "forbidden",
          "Tenant context is required",
          incidentId,
        ),
      };
    }

    return {
      context: {
        token,
        userId: data.user.id,
        tenantId,
      },
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[intake] failed to validate Supabase token", error);
    }

    return {
      error: jsonError(
        500,
        "auth_error",
        "Unable to validate Supabase token",
        incidentId,
      ),
    };
  }
}

function mapMissionBriefToChips(brief: BackendResponse["mission_brief"]) {
  return Object.entries(brief)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([field, value]) => ({ field, value }));
}

async function callBackend(
  payload: ParsedPayload,
  auth: AuthContext,
  incidentId: string,
) {
  const baseUrl = process.env.AGENT_HTTP_URL ?? DEFAULT_AGENT_URL;
  const target = new URL("/intake/generate", baseUrl);

  const body = {
    mission_id: payload.missionId,
    mission_intent: payload.intent,
    hints: payload.hints ?? {},
    auth_context: {
      user_id: auth.userId,
      tenant_id: auth.tenantId,
    },
  };

  let response: Response;
  try {
    response = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-supabase-user-id": auth.userId,
        "x-supabase-tenant-id": auth.tenantId,
        authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[intake] failed to reach IntakeAgent backend", error);
    }

    return {
      error: jsonError(
        502,
        "backend_unreachable",
        "Unable to reach intake service",
        incidentId,
      ),
    } as const;
  }

  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {
      error: jsonError(
        502,
        "backend_invalid_response",
        "Intake service returned invalid JSON",
        incidentId,
        { backend_status: response.status },
      ),
    } as const;
  }

  if (!response.ok) {
    const details =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : { backend_response: parsed };

    return {
      error: jsonError(
        502,
        "backend_error",
        "Intake service returned an error",
        incidentId,
        { backend_status: response.status, ...details },
      ),
    } as const;
  }

  try {
    return { data: backendResponseSchema.parse(parsed) } as const;
  } catch (error) {
    return {
      error: jsonError(
        502,
        "backend_invalid_payload",
        "Intake service response was missing required fields",
        incidentId,
      ),
    } as const;
  }
}

export async function POST(request: Request) {
  const incidentId = createIncidentId();

  const parsed = await parsePayload(request, incidentId);
  if (parsed.error) {
    return parsed.error;
  }

  const auth = await authenticateRequest(request, incidentId);
  if (auth.error || !auth.context) {
    return auth.error;
  }

  const rateCheck = intakeRateLimiter.check(auth.context.tenantId);
  if (!rateCheck.allowed) {
    const retryAfterSeconds = Math.ceil(rateCheck.retryAfterMs / 1000);
    return jsonError(
      429,
      "rate_limited",
      "Too many intake requests. Please retry later.",
      incidentId,
      {
        retry_after_ms: rateCheck.retryAfterMs,
        reset_at: rateCheck.resetAt,
      },
      retryAfterSeconds > 0
        ? {
            "Retry-After": `${retryAfterSeconds}`,
          }
        : undefined,
    );
  }

  emitServerTelemetry("intent_submitted", {
    mission_id: parsed.payload.missionId,
    tenant_id: auth.context.tenantId,
    user_id: auth.context.userId,
    intent_length: parsed.payload.intent.length,
    has_hints: Boolean(parsed.payload.hints),
  });

  const startedAt = Date.now();
  const backend = await callBackend(parsed.payload, auth.context, incidentId);
  if (backend.error || !backend.data) {
    return backend.error;
  }

  const latencyMs = backend.data.generation_latency_ms ?? Date.now() - startedAt;

  const chips = mapMissionBriefToChips(backend.data.mission_brief);

  emitServerTelemetry("brief_generated", {
    mission_id: parsed.payload.missionId,
    tenant_id: auth.context.tenantId,
    user_id: auth.context.userId,
    chip_count: chips.length,
    confidence_scores: backend.data.confidence_scores,
    generation_latency_ms: latencyMs,
  });

  return NextResponse.json(
    {
      chips,
      mission_brief: backend.data.mission_brief,
      confidence_scores: backend.data.confidence_scores,
      safeguards: backend.data.safeguards,
      generation_latency_ms: latencyMs,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
