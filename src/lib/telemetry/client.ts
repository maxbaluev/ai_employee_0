export type TelemetryEventName =
  | "home_tile_opened"
  | "readiness_badge_rendered"
  | "alert_rail_viewed"
  | "mission_list_action_taken";

export type TelemetryPayload = Record<string, unknown>;

export function emitTelemetry(
  eventName: TelemetryEventName,
  payload: TelemetryPayload,
) {
  if (typeof window === "undefined") {
    return;
  }

  // TODO: replace console bridge with real telemetry transport (docs/06_data_intelligence.md §3.1).
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info("[telemetry]", eventName, payload);
  }
}
