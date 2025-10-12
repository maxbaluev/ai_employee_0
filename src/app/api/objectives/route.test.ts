// Tests for /api/objectives tenant enforcement.

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

function createRequest(body: unknown): NextRequest {
  const request = new Request("http://localhost/api/objectives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return request as unknown as NextRequest;
}

describe("POST /api/objectives", () => {
  it("returns 401 when tenant context missing", async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    });

    const response = await POST(
      createRequest({
        goal: "Test goal",
        audience: "Test audience",
        timeframe: "Q4",
        guardrails: {},
      }),
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload).toEqual({
      error: "Authenticate with Supabase or supply tenantId in the payload",
      hint: "Authenticate with Supabase or include tenantId in the request body.",
    });
  });

  it("creates objective when tenant provided", async () => {
    const sessionMock = vi.fn().mockResolvedValue({
      data: { session: { user: { id: "tenant-123" } } },
      error: null,
    });
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: { getSession: sessionMock },
    });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "objective-1",
            tenant_id: "tenant-123",
            goal: "Test goal",
            audience: "Test audience",
            timeframe: "Q4",
            guardrails: {},
            status: "draft",
          },
          error: null,
        }),
      }),
    });

    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: insertMock }),
    });

    const response = await POST(
      createRequest({
        goal: "Test goal",
        audience: "Test audience",
        timeframe: "Q4",
        guardrails: {},
      }),
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.objective.goal).toBe("Test goal");
    expect(insertMock).toHaveBeenCalled();
  });
});
