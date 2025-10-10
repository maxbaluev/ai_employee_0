/// <reference types="vitest" />

import { act, renderHook } from '@testing-library/react';

import { useTimelineEvents } from '../useTimelineEvents';

describe('useTimelineEvents', () => {
  const agentId = 'control_plane_foundation';
  const tenantId = '3c33212c-d119-4ef1-8db0-2ca93cd3b2dd';
  const sessionIdentifier = 'mission-123';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('maps planner status events and tracks heartbeat', async () => {
    const initialPayload = {
      messages: [
        {
          id: 'event-1',
          createdAt: '2025-10-09T16:00:00.000Z',
          stage: null,
          role: 'assistant',
          metadata: {
            stage: 'planner_status',
            event: 'status_update',
            status_type: 'library_query',
            audience: 'Revenue Ops',
          },
          content: 'Planner library query update',
        },
      ],
      count: 1,
      nextCursor: null,
      fetchedAt: '2025-10-09T16:00:00.100Z',
    };

    const deltaPayload = {
      messages: [],
      count: 0,
      nextCursor: null,
      fetchedAt: '2025-10-09T16:00:01.000Z',
    };

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(initialPayload), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValue(
        new Response(JSON.stringify(deltaPayload), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      );

    const { result } = renderHook(() =>
      useTimelineEvents({
        agentId,
        tenantId,
        sessionIdentifier,
        enabled: true,
        pollIntervalMs: 1000,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0]).toMatchObject({
      stage: 'planner_status',
      label: 'Planner update',
      description: expect.stringContaining('Revenue Ops'),
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    expect(result.current.heartbeatSeconds).not.toBeNull();
    expect(result.current.heartbeatSeconds ?? 0).toBeGreaterThan(0);
  });
});
