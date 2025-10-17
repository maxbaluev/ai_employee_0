import { NextResponse } from "next/server";
import { z } from "zod";

import { createSSEStream, SSE_HEADERS } from "@/lib/server/sse";
import { getServiceSupabaseClient } from "@/lib/server/supabase";
import { emitServerTelemetry } from "@/lib/telemetry/server";

const payloadSchema = z.object({
  mission_id: z.string().uuid("mission_id must be a valid UUID"),
  play_id: z.string().uuid("play_id must be a valid UUID"),
});

type ParsedPayload = z.infer<typeof payloadSchema>;

type AuthContext = {
  token: string;
  userId: string;
  tenantId: string;
};

type AuthResult = { context?: AuthContext; error?: NextResponse };

type BackendEvent = {
  type?: string;
  id?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

const DEFAULT_BACKEND_URL = "http://localhost:8000";
const HEARTBEAT_INTERVAL_MS = 30_000;

function randomId(): string {
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

async function parsePayload(
  request: Request,
  incidentId: string,
): Promise<{ payload?: ParsedPayload; error?: NextResponse }> {
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return {
      error: jsonError(
        400,
        "invalid_json",
        "Request body must be valid JSON",
        incidentId,
      ),
    };
  }

  try {
    return { payload: payloadSchema.parse(body) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: jsonError(
          400,
          "invalid_request",
          "Invalid execution payload",
          incidentId,
          { details: error.issues },
        ),
      };
    }

    return {
      error: jsonError(
        400,
        "invalid_request",
        "Unable to parse execution payload",
        incidentId,
      ),
    };
  }
}

async function authenticateRequest(
  request: Request,
  incidentId: string,
): Promise<AuthResult> {
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

    const metadata =
      (data.user.user_metadata as Record<string, unknown> | undefined) ?? {};
    const tenantId = metadata.tenantId;

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
      console.error("[execution] failed to validate Supabase token", error);
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

function backendUrl(): URL {
  const base = process.env.AGENT_HTTP_URL ?? DEFAULT_BACKEND_URL;
  return new URL("/execution/run", base);
}

function normaliseBackendEvent(event: BackendEvent): BackendEvent {
  const normalised: BackendEvent = { ...event };
  if (normalised.type && typeof normalised.type === "string") {
    normalised.type = normalised.type.trim();
  }
  return normalised;
}

function emitTelemetry(
  type: string,
  payload: Record<string, unknown>,
) {
  switch (type) {
    case "execution_started":
    case "execution_step_completed":
    case "composio_tool_call":
    case "validator_alert_raised":
    case "session_heartbeat":
      emitServerTelemetry(type, payload);
      break;
    default:
      break;
  }
}

function encodeSSEData(data: Record<string, unknown>) {
  return {
    ...data,
  };
}

export async function POST(request: Request) {
  const incidentId = randomId();

  const parsed = await parsePayload(request, incidentId);
  if (parsed.error || !parsed.payload) {
    return parsed.error;
  }

  const auth = await authenticateRequest(request, incidentId);
  if (auth.error || !auth.context) {
    return auth.error;
  }

  const abortController = new AbortController();
  const backendTarget = backendUrl();

  const { stream, send, close } = createSSEStream((reason) => {
    if (!abortController.signal.aborted) {
      abortController.abort(reason);
    }
  });

  const response = new Response(stream, {
    status: 200,
    headers: SSE_HEADERS,
  });

  const cleanup = () => {
    close();
    request.signal.removeEventListener("abort", cancelHandler);
    clearInterval(heartbeatInterval);
  };

  const cancelHandler = () => {
    abortController.abort();
    cleanup();
  };

  request.signal.addEventListener("abort", cancelHandler);

  const heartbeatPayload = {
    mission_id: parsed.payload.mission_id,
    tenant_id: auth.context.tenantId,
  };

  const heartbeatInterval = setInterval(() => {
    send({ event: "session_heartbeat", data: encodeSSEData(heartbeatPayload) });
    emitTelemetry("session_heartbeat", heartbeatPayload);
  }, HEARTBEAT_INTERVAL_MS).unref?.();

  (async () => {
    try {
      const body = {
        mission_id: parsed.payload.mission_id,
        play_id: parsed.payload.play_id,
        auth_context: {
          user_id: auth.context.userId,
          tenant_id: auth.context.tenantId,
        },
      };

      emitTelemetry("execution_started", {
        mission_id: parsed.payload.mission_id,
        play_id: parsed.payload.play_id,
        tenant_id: auth.context.tenantId,
      });
      send({
        event: "execution_started",
        data: encodeSSEData({
          mission_id: parsed.payload.mission_id,
          play_id: parsed.payload.play_id,
        }),
      });

      let backendResponse: Response;
      try {
        backendResponse = await fetch(backendTarget, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${auth.context.token}`,
            "x-supabase-user-id": auth.context.userId,
            "x-supabase-tenant-id": auth.context.tenantId,
          },
          body: JSON.stringify(body),
          signal: abortController.signal,
        });
      } catch (error) {
        send({
          event: "error",
          data: encodeSSEData({
            message: "Unable to reach execution service",
            incident_id: incidentId,
          }),
        });
        return;
      }

      if (!backendResponse.ok) {
        const text = await backendResponse.text();
        send({
          event: "error",
          data: encodeSSEData({
            message: "Execution service returned an error",
            incident_id: incidentId,
            backend_status: backendResponse.status,
            backend_response: text,
          }),
        });
        return;
      }

      if (!backendResponse.body) {
        send({
          event: "error",
          data: encodeSSEData({
            message: "Execution service did not return a stream",
            incident_id: incidentId,
          }),
        });
        return;
      }

      const reader = backendResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (line) {
            try {
              const event = normaliseBackendEvent(JSON.parse(line));
              const data = encodeSSEData({
                ...event.data,
                mission_id: parsed.payload.mission_id,
              });
              const eventType = event.type ?? "message";

              emitTelemetry(eventType, {
                mission_id: parsed.payload.mission_id,
                tenant_id: auth.context.tenantId,
                user_id: auth.context.userId,
                payload: event,
              });

              send({
                id: event.id ? String(event.id) : undefined,
                event: eventType,
                data,
              });
            } catch (error) {
              send({
                event: "error",
                data: encodeSSEData({
                  message: "Invalid execution stream payload",
                  incident_id: incidentId,
                }),
              });
            }
          }

          newlineIndex = buffer.indexOf("\n");
        }
      }

      if (buffer.trim()) {
        try {
          const event = normaliseBackendEvent(JSON.parse(buffer.trim()));
          const data = encodeSSEData({
            ...event.data,
            mission_id: parsed.payload.mission_id,
          });
          const eventType = event.type ?? "message";
          emitTelemetry(eventType, {
            mission_id: parsed.payload.mission_id,
            tenant_id: auth.context.tenantId,
            user_id: auth.context.userId,
            payload: event,
          });
          send({
            id: event.id ? String(event.id) : undefined,
            event: eventType,
            data,
          });
        } catch (error) {
          send({
            event: "error",
            data: encodeSSEData({
              message: "Invalid execution stream payload",
              incident_id: incidentId,
            }),
          });
        }
      }

      send({
        event: "execution_complete",
        data: encodeSSEData({ mission_id: parsed.payload.mission_id }),
      });
    } catch (error) {
      if (!abortController.signal.aborted) {
        send({
          event: "error",
          data: encodeSSEData({
            message: "Execution stream terminated unexpectedly",
            incident_id: incidentId,
          }),
        });
      }
    } finally {
      cleanup();
    }
  })();

  return response;
}

