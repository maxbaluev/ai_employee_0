import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/supabase", () => ({
  getServiceSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/telemetry/server", () => ({
  emitServerTelemetry: vi.fn(),
}));

import { POST } from "@/app/api/intake/generate/route";
import { intakeRateLimiter } from "@/lib/server/rate-limiter";
import { getServiceSupabaseClient } from "@/lib/server/supabase";
import { emitServerTelemetry } from "@/lib/telemetry/server";

const getServiceSupabaseClientMock = vi.mocked(getServiceSupabaseClient);
const emitServerTelemetryMock = vi.mocked(emitServerTelemetry);

const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

const userId = "5c6410af-46e3-4dac-8453-51b7ce5d8fa2";
const tenantId = "tenant-123";
const missionId = "550e8400-e29b-41d4-a716-446655440000";

const basePayload = {
  missionId,
  intent: "Re-engage high value manufacturing accounts",
  persona: "revops" as const,
  hints: { objective: "Bring back dormant accounts" },
};

function buildRequest(
  payload: Record<string, unknown>,
  headers: Record<string, string | undefined> = {},
) {
  return new Request("http://localhost/api/intake/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: headers.authorization ?? "Bearer valid-token",
    },
    body: JSON.stringify(payload),
  });
}

const defaultBackendResponse = {
  mission_brief: {
    objective: "Re-engage high value manufacturing accounts",
    audience: "Dormant revenue accounts",
    kpi: "≥3% reply rate",
    timeline: "3 business days",
  },
  confidence_scores: {
    objective: 0.9,
    audience: 0.7,
    kpi: 0.65,
    timeline: 0.6,
  },
  safeguards: [
    {
      description: "Respect opt-out preferences",
      severity: "medium",
    },
  ],
  generation_latency_ms: 420,
};

beforeEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);

  const getUserMock = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: userId,
        user_metadata: { tenantId },
        app_metadata: {},
      },
    },
    error: null,
  });

  getServiceSupabaseClientMock.mockReturnValue({
    auth: {
      getUser: getUserMock,
    },
  } as unknown as ReturnType<typeof getServiceSupabaseClient>);

  emitServerTelemetryMock.mockReset();
  intakeRateLimiter.reset();
  delete process.env.AGENT_HTTP_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/intake/generate", () => {
  it("returns generated mission chips on success", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify(defaultBackendResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await POST(buildRequest(basePayload));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      chips: expect.arrayContaining([
        { field: "objective", value: expect.any(String) },
        { field: "audience", value: expect.any(String) },
      ]),
      confidence_scores: defaultBackendResponse.confidence_scores,
      safeguards: defaultBackendResponse.safeguards,
      generation_latency_ms: defaultBackendResponse.generation_latency_ms,
    });
    expect(emitServerTelemetryMock).toHaveBeenCalledWith(
      "intent_submitted",
      expect.objectContaining({
        mission_id: missionId,
        tenant_id: tenantId,
      }),
    );
    expect(emitServerTelemetryMock).toHaveBeenCalledWith(
      "brief_generated",
      expect.objectContaining({
        mission_id: missionId,
        chip_count: expect.any(Number),
      }),
    );
  });

  it("uses custom AGENT_HTTP_URL when provided", async () => {
    process.env.AGENT_HTTP_URL = "https://agent.internal";

    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      expect(url instanceof URL ? url.origin : String(url)).toContain(
        "agent.internal",
      );
      return new Response(JSON.stringify(defaultBackendResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const response = await POST(buildRequest(basePayload));
    expect(response.status).toBe(200);
  });

  it("rejects invalid JSON payload", async () => {
    const invalidRequest = new Request("http://localhost/api/intake/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    const response = await POST(invalidRequest);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_json" });
  });

  it("rejects payloads missing required fields", async () => {
    const response = await POST(
      buildRequest({ intent: "short" }, { authorization: "Bearer valid" }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_request");
    expect(body.details).toBeDefined();
  });

  it("requires authorization header", async () => {
    const request = new Request("http://localhost/api/intake/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(basePayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("rejects invalid tokens", async () => {
    const getUserMock = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    getServiceSupabaseClientMock.mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
    } as unknown as ReturnType<typeof getServiceSupabaseClient>);

    const response = await POST(buildRequest(basePayload));
    expect(response.status).toBe(401);
  });

  it("requires tenant context", async () => {
    const getUserMock = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: userId,
          user_metadata: {},
          app_metadata: {},
        },
      },
      error: null,
    });
    getServiceSupabaseClientMock.mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
    } as unknown as ReturnType<typeof getServiceSupabaseClient>);

    const response = await POST(buildRequest(basePayload));
    expect(response.status).toBe(403);
  });

  it("rate limits repeated requests per tenant", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify(defaultBackendResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    // First five requests pass.
    for (let i = 0; i < 5; i += 1) {
      const response = await POST(buildRequest(basePayload));
      expect(response.status).toBe(200);
    }

    const response = await POST(buildRequest(basePayload));
    expect(response.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("maps backend errors to 502", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: "invalid_context", message: "missing mission" }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    const response = await POST(buildRequest(basePayload));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.backend_status).toBe(400);
  });

  it("handles invalid backend JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
    );

    const response = await POST(buildRequest(basePayload));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("backend_invalid_response");
  });
});
