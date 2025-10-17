import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/execution/run/route";
import { SSE_HEADERS } from "@/lib/server/sse";
import { emitServerTelemetry } from "@/lib/telemetry/server";

const mockGetUser = vi.fn();

vi.mock("@/lib/server/supabase", () => ({
  getServiceSupabaseClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

vi.mock("@/lib/telemetry/server", () => ({
  emitServerTelemetry: vi.fn(),
}));

const mockedTelemetry = vi.mocked(emitServerTelemetry);

const encoder = new TextEncoder();

function buildRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/execution/run", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function mockAuth(userId = "user-1", tenantId = "tenant-1") {
  mockGetUser.mockResolvedValueOnce({
    data: {
      user: {
        id: userId,
        user_metadata: { tenantId },
      },
    },
    error: null,
  });
}

function buildStream(lines: Record<string, unknown>[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      }
      controller.close();
    },
  });
}

async function readResponseBody(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }
  const decoder = new TextDecoder();
  let output = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    output += decoder.decode(value);
  }
  return output;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn());
  mockGetUser.mockReset();
  mockedTelemetry.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockReset?.();
});

describe("POST /api/execution/run", () => {
  it("rejects invalid JSON", async () => {
    const request = new Request("http://localhost/api/execution/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("requires authorization header", async () => {
    const request = buildRequest({ mission_id: "d3f8f0c0-5a44-4a75-8fc8-90e7f0f4b4d4", play_id: "0f73579c-6539-4a31-bc78-7b47670ef13d" });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("streams backend events and emits telemetry", async () => {
    mockAuth();

    const stream = buildStream([
      { type: "execution_step_completed", data: { action_id: "action-1" } },
      { type: "execution_complete" },
    ]);

    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(stream, { status: 200 }),
    );

    const request = buildRequest(
      {
        mission_id: "d3f8f0c0-5a44-4a75-8fc8-90e7f0f4b4d4",
        play_id: "0f73579c-6539-4a31-bc78-7b47670ef13d",
      },
      { authorization: "Bearer token" },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    const lowerCaseHeaders = Object.fromEntries(
      Array.from(response.headers.entries()).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    );
    const expectedHeaders = Object.fromEntries(
      Object.entries(SSE_HEADERS).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    );
    expect(lowerCaseHeaders).toMatchObject(expectedHeaders);

    const body = await readResponseBody(response);
    expect(body).toContain("event: execution_started");
    expect(body).toContain("event: execution_step_completed");
    expect(body).toContain("event: execution_complete");

    const telemetryCalls = mockedTelemetry.mock.calls;
    expect(telemetryCalls.some(([name]) => name === "execution_started")).toBe(
      true,
    );
    expect(
      telemetryCalls.some(([name]) => name === "execution_step_completed"),
    ).toBe(true);
  });

  it("sends error event when backend fails", async () => {
    mockAuth();

    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("failure", { status: 502 }),
    );

    const request = buildRequest(
      {
        mission_id: "d3f8f0c0-5a44-4a75-8fc8-90e7f0f4b4d4",
        play_id: "0f73579c-6539-4a31-bc78-7b47670ef13d",
      },
      { authorization: "Bearer token" },
    );

    const response = await POST(request);
    const body = await readResponseBody(response);
    expect(body).toContain("event: error");
  });
});
