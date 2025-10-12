import { render, waitFor } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { StreamingStatusPanel } from '@/components/StreamingStatusPanel';

const telemetryMock = vi.hoisted(() => vi.fn());
const heartbeatState = vi.hoisted(() => ({
  samples: [
    7000,
    7200,
    6800,
    7100,
    6900,
    7050,
    7025,
    7180,
    7075,
    6950,
  ],
  index: 0,
}));

vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: (...args: unknown[]) => telemetryMock(...args),
}));

vi.mock('@/hooks/useTimelineEvents', () => ({
  useTimelineEvents: () => {
    const heartbeat = heartbeatState.samples[
      Math.min(heartbeatState.index, heartbeatState.samples.length - 1)
    ];
    return {
      events: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      lastUpdated: null,
      exitInfo: null,
      heartbeatSeconds: heartbeat,
      lastEventAt: null,
    };
  },
}));

beforeEach(() => {
  telemetryMock.mockReset();
  heartbeatState.index = 0;
  (globalThis as Record<string, unknown>).__STREAMING_HEARTBEAT_TELEMETRY__ = telemetryMock;
});

afterAll(() => {
  vi.unmock('@/hooks/useTimelineEvents');
  vi.unmock('@/lib/telemetry/client');
  delete (globalThis as Record<string, unknown>).__STREAMING_HEARTBEAT_TELEMETRY__;
});

describe('Gate G-B streaming heartbeat telemetry', () => {
  it('enforces 5s p95 heartbeat SLA with a single telemetry dispatch', async () => {
    const { rerender } = render(
      <StreamingStatusPanel
        tenantId="tenant-telemetry"
        agentId="agent-x"
        sessionIdentifier="session-alpha"
        pollIntervalMs={1000}
      />,
    );

    for (let i = 1; i < heartbeatState.samples.length; i += 1) {
      heartbeatState.index = i;
      rerender(
        <StreamingStatusPanel
          tenantId="tenant-telemetry"
          agentId="agent-x"
          sessionIdentifier="session-alpha"
          pollIntervalMs={1000}
        />,
      );
    }

    await waitFor(() => {
      expect(telemetryMock).toHaveBeenCalledTimes(1);
    });

    const [, payload] = telemetryMock.mock.calls[0];
    expect(payload).toMatchObject({ eventName: 'streaming_heartbeat_metrics' });
    expect(payload.eventData?.p95).toBeLessThanOrEqual(5000);
  });
});
