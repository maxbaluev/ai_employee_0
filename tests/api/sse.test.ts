import { describe, expect, it } from "vitest";

import { createSSEStream, formatSSEEvent } from "@/lib/server/sse";

describe("formatSSEEvent", () => {
  it("formats basic event", () => {
    expect(formatSSEEvent({ event: "test", data: { ok: true } })).toBe(
      "event: test\ndata: {\"ok\":true}\n\n",
    );
  });

  it("supports multiline data", () => {
    const payload = "line1\nline2";
    expect(formatSSEEvent({ data: payload })).toBe(
      "data: line1\ndata: line2\n\n",
    );
  });

  it("includes id and retry", () => {
    expect(formatSSEEvent({ id: "42", retry: 1000, data: "ping" })).toBe(
      "id: 42\nretry: 1000\ndata: ping\n\n",
    );
  });
});

describe("createSSEStream", () => {
  it("pushes encoded chunks", async () => {
    const { stream, send, close } = createSSEStream();

    const reader = stream.getReader();
    send({ event: "demo", data: { value: 1 } });
    close();

    const chunks: string[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }

    expect(chunks.join(""))
      .toBe("event: demo\ndata: {\"value\":1}\n\n");
  });
});

