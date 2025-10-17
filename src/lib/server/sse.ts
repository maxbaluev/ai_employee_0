export type SSEEvent = {
  event?: string;
  data?: unknown;
  id?: string;
  retry?: number;
};

const encoder = new TextEncoder();

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export function formatSSEEvent(event: SSEEvent): string {
  const lines: string[] = [];

  if (event.id) {
    lines.push(`id: ${event.id}`);
  }
  if (event.event) {
    lines.push(`event: ${event.event}`);
  }
  if (typeof event.retry === "number" && Number.isFinite(event.retry)) {
    lines.push(`retry: ${Math.max(0, Math.trunc(event.retry))}`);
  }

  if (event.data !== undefined) {
    const payload =
      typeof event.data === "string"
        ? event.data
        : JSON.stringify(event.data);

    for (const line of payload.split(/\r?\n/)) {
      lines.push(`data: ${line}`);
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function createSSEStream(
  onClose?: (reason?: unknown) => void,
): {
  stream: ReadableStream<Uint8Array>;
  send: (event: SSEEvent) => void;
  close: () => void;
} {
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
    cancel(reason) {
      closed = true;
      onClose?.(reason);
    },
  });

  function send(event: SSEEvent) {
    if (closed || !controllerRef) {
      return;
    }
    controllerRef.enqueue(encoder.encode(formatSSEEvent(event)));
  }

  function close() {
    if (closed) {
      return;
    }
    closed = true;
    onClose?.();
    controllerRef?.close();
  }

  return { stream, send, close };
}

