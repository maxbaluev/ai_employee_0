"use client";

import { redactTelemetryEvent } from './redaction';

export type TelemetryEventPayload = {
  eventName: string;
  missionId?: string | null;
  eventData?: Record<string, unknown>;
};

export async function sendTelemetryEvent(
  tenantId: string,
  payload: TelemetryEventPayload,
): Promise<void> {
  if (!tenantId) {
    console.warn('[telemetry] Skipping telemetry event without tenant id.');
    return;
  }

  try {
    const safePayload = {
      tenantId,
      eventName: payload.eventName,
      missionId: payload.missionId ?? undefined,
      eventData: payload.eventData ? redactTelemetryEvent(payload.eventData) : {},
    };

    await fetch('/api/intake/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safePayload),
    });
  } catch (error) {
    console.warn('[telemetry] Failed to emit event', error);
  }
}
