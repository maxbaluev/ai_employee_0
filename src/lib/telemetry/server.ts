export type ServerTelemetryEventName =
  | "approval_requested"
  | "approval_granted"
  | "approval_rejected"
  | "audit_event_recorded";

export type ServerTelemetryPayload = Record<string, unknown>;

/**
 * Placeholder server-side telemetry emitter.
 *
 * For now we simply log to stdout so consumers can verify payloads during
 * development. Once the telemetry pipeline is wired we can route these events
 * to Supabase (see docs/06_data_intelligence.md §3.5).
 */
export function emitServerTelemetry(
  eventName: ServerTelemetryEventName,
  payload: ServerTelemetryPayload,
) {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info("[telemetry]", eventName, payload);
  }
}
