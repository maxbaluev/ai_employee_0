/// <reference types="vitest" />

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UseTimelineEventsResult } from '@/hooks/useTimelineEvents';

const useTimelineEventsMock = vi.hoisted(
  () => vi.fn<[], UseTimelineEventsResult>(),
);

vi.mock('@/hooks/useTimelineEvents', () => ({
  useTimelineEvents: useTimelineEventsMock,
}));

const sendTelemetryEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: sendTelemetryEventMock,
}));

import { StreamingStatusPanel } from '../StreamingStatusPanel';

const baseHookResult: UseTimelineEventsResult = {
  events: [],
  isLoading: false,
  error: null,
  refresh: vi.fn(),
  lastUpdated: '2025-10-09T19:00:00.000Z',
  exitInfo: null,
  heartbeatSeconds: 2.4,
  lastEventAt: '2025-10-09T19:00:00.000Z',
};

describe('StreamingStatusPanel', () => {
  const tenantId = '3c33212c-d119-4ef1-8db0-2ca93cd3b2dd';
  const agentId = 'control_plane_foundation';
  const sessionIdentifier = 'mission-123';

  const renderPanel = (props: Record<string, unknown> = {}) =>
    render(
      <StreamingStatusPanel
        {...({
          tenantId,
          agentId,
          sessionIdentifier,
          ...props,
        } as any)}
      />,
    );

  beforeEach(() => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      refresh: vi.fn(),
    });
  });

  afterEach(() => {
    useTimelineEventsMock.mockReset();
    sendTelemetryEventMock.mockReset();
    vi.restoreAllMocks();
  });

  it('shows heartbeat indicator and expandable metadata details', async () => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      events: [
        {
          id: 'evt-1',
          createdAt: '2025-10-09T19:00:00.000Z',
          stage: 'executor_status',
          event: 'toolkit_simulation',
          role: 'assistant',
          label: 'Toolkit simulation',
          description: 'Simulating sheets',
          status: 'in_progress' as const,
          rawContent: 'Simulating sheets toolkit',
          metadata: { toolkit: 'sheets', position: 1, total: 3 },
        },
      ],
      heartbeatSeconds: 2.4,
    });

    const user = userEvent.setup();

    render(
      <StreamingStatusPanel
        tenantId={tenantId}
        agentId={agentId}
        sessionIdentifier={sessionIdentifier}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: /Toolkit simulation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Heartbeat: 2.4s/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Show details/i }));
    expect(screen.getByText(/toolkit/i, { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText(/sheets/i, { selector: 'dd' })).toBeInTheDocument();
  });

  it('renders waiting guidance for validator retry', async () => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      events: [
        {
          id: 'evt-1',
          createdAt: '2025-10-09T19:00:00.000Z',
          stage: 'validator_feedback',
          event: 'completion',
          role: 'assistant',
          label: 'Validator outcome',
          description: 'Validator requested retry',
          status: 'warning' as const,
          rawContent: 'retry later',
          metadata: { status: 'retry_later', violations: ['quiet_window_missing'] },
        },
      ],
      heartbeatSeconds: 7.8,
    });

    render(
      <StreamingStatusPanel
        tenantId={tenantId}
        agentId={agentId}
        sessionIdentifier={sessionIdentifier}
      />,
    );

    expect(await screen.findByText(/Validator outcome/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Validator retry scheduled: quiet_window_missing/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Heartbeat: 7.8s/)).toBeInTheDocument();
  });

  it('prioritises reviewer escalation guidance when requested', async () => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      events: [
        {
          id: 'evt-1',
          createdAt: '2025-10-09T19:00:00.000Z',
          stage: 'validator_reviewer_requested',
          event: 'reviewer_requested',
          role: 'assistant',
          label: 'Reviewer attention required',
          description: 'Validator escalated (ask_reviewer).',
          status: 'warning' as const,
          rawContent: 'Reviewer requested',
          metadata: { status: 'ask_reviewer', attempt: 2, tool_call_id: 'tool-123' },
        },
      ],
    });

    const reviewerNotified = vi.fn();

    render(
      <StreamingStatusPanel
        tenantId={tenantId}
        agentId={agentId}
        sessionIdentifier={sessionIdentifier}
        onReviewerRequested={reviewerNotified}
      />,
    );

    expect(
      await screen.findByText(/Validator requested input. Open the approval modal/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open approval modal/i })).toBeEnabled();
  });

  it('surfaces undo plan metadata via callback when available', async () => {
    const onUndoPlanDetected = vi.fn();

    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      events: [
        {
          id: 'evt-undo',
          createdAt: '2025-10-09T19:05:00.000Z',
          stage: 'validator_reviewer_requested',
          event: 'reviewer_requested',
          role: 'assistant',
          label: 'Reviewer attention required',
          description: 'Validator escalated (ask_reviewer).',
          status: 'warning' as const,
          rawContent: 'Undo available',
          metadata: {
            tool_call_id: 'call-123',
            undo_summary: 'Delete comment from CRM',
            risk_tags: ['tone', 'quiet window'],
            undo_window_seconds: 180,
            override_allowed: true,
            override_url: 'https://governance.example/override',
            undo_token: 'token-xyz',
          },
        },
      ],
    });

    render(
      <StreamingStatusPanel
        tenantId={tenantId}
        agentId={agentId}
        sessionIdentifier={sessionIdentifier}
        onUndoPlanDetected={onUndoPlanDetected}
      />,
    );

    await waitFor(() => {
      expect(onUndoPlanDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          toolCallId: 'call-123',
          undoSummary: 'Delete comment from CRM',
          riskTags: ['tone', 'quiet window'],
          undoWindowSeconds: 180,
          overrideAllowed: true,
          overrideUrl: 'https://governance.example/override',
          undoToken: 'token-xyz',
          issuedAt: '2025-10-09T19:05:00.000Z',
        }),
      );
    });
  });

  it('shows alert heartbeat when latency exceeds threshold and handles pause toggle', async () => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      heartbeatSeconds: 12.3,
      events: [
        {
          id: 'evt-1',
          createdAt: '2025-10-09T19:00:00.000Z',
          stage: 'planner_rank_complete',
          event: 'rank_complete',
          role: 'assistant',
          label: 'Planner ranked plays',
          description: 'Planner run completed.',
          status: 'complete' as const,
          rawContent: 'Planner run completed.',
          metadata: { candidate_count: 3 },
        },
      ],
    });

    const user = userEvent.setup();

    render(
      <StreamingStatusPanel
        tenantId={tenantId}
        agentId={agentId}
        sessionIdentifier={sessionIdentifier}
      />,
    );

    expect(await screen.findByText(/Planner ranked plays/i)).toBeInTheDocument();
    expect(screen.getByText(/Heartbeat: 12.3s/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Pause/i }));
    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument();
    expect(screen.getByText(/Heartbeat: —/)).toBeInTheDocument();
  });

  it('surfaces heartbeat warnings above threshold and decorates completed events with checkmarks', () => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      heartbeatSeconds: 6.4,
      events: [
        {
          id: 'evt-complete',
          createdAt: '2025-10-09T19:01:00.000Z',
          stage: 'planner_rank_complete',
          event: 'rank_complete',
          role: 'assistant',
          label: 'Planner ranked plays',
          description: 'Planner returned 3 ranked plays.',
          status: 'complete' as const,
          rawContent: 'Planner complete',
          metadata: { candidate_count: 3 },
        },
      ],
    });

    renderPanel();

    expect(screen.getByText('Heartbeat: 6.4s')).toBeInTheDocument();
    expect(screen.getByText(/High latency/i)).toBeInTheDocument();

    const plannerArticle = screen.getByText('Planner ranked plays').closest('article');
    expect(plannerArticle).toBeTruthy();
    expect(within(plannerArticle as HTMLElement).getByText('✓')).toBeInTheDocument();
  });

  it('renders exit banner and disables controls when run completes', async () => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      exitInfo: {
        reason: 'completed',
        stage: 'execution_loop_completed',
        missionStatus: 'completed',
        at: '2025-10-09T19:05:00.000Z',
      },
      events: [
        {
          id: 'evt-1',
          createdAt: '2025-10-09T19:00:00.000Z',
          stage: 'execution_loop_completed',
          event: 'completed',
          role: 'assistant',
          label: 'Dry-run completed',
          description: 'Completed after 1 attempt.',
          status: 'complete' as const,
          rawContent: 'Execution loop completed',
          metadata: { attempts: 1 },
        },
      ],
    });

    render(
      <StreamingStatusPanel
        tenantId={tenantId}
        agentId={agentId}
        sessionIdentifier={sessionIdentifier}
      />,
    );

    expect(
      await screen.findByText(/Dry-run loop completed and timeline is archived/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pause/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeDisabled();
  });

  it('renders cancel control and fires onCancelSession when used', async () => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      events: [
        {
          id: 'evt-1',
          createdAt: '2025-10-09T19:00:00.000Z',
          stage: 'executor_status',
          event: 'toolkit_simulation',
          role: 'assistant',
          label: 'Toolkit simulation',
          description: 'Simulating sheets',
          status: 'in_progress' as const,
          rawContent: 'Simulating sheets toolkit',
          metadata: { toolkit: 'sheets' },
        },
      ],
      heartbeatSeconds: 3.2,
    });

    const onCancelSession = vi.fn();
    const user = userEvent.setup();

    renderPanel({
      onCancelSession,
    });

    const cancelButton = await screen.findByRole('button', { name: /Cancel run/i });
    expect(cancelButton).toBeEnabled();

    await user.click(cancelButton);
    expect(onCancelSession).toHaveBeenCalledTimes(1);
  });

  it('disables cancel control once the mission exits', async () => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      exitInfo: {
        reason: 'completed',
        stage: 'execution_loop_completed',
        missionStatus: 'completed',
        at: '2025-10-09T19:05:00.000Z',
      },
      events: [
        {
          id: 'evt-1',
          createdAt: '2025-10-09T19:00:00.000Z',
          stage: 'execution_loop_completed',
          event: 'completed',
          role: 'assistant',
          label: 'Dry-run completed',
          description: 'Completed after 1 attempt.',
          status: 'complete' as const,
          rawContent: 'Execution loop completed',
          metadata: { attempts: 1 },
        },
      ],
    });

    renderPanel({
      onCancelSession: vi.fn(),
    });

    expect(
      await screen.findByText(/Dry-run loop completed and timeline is archived/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel run/i })).toBeDisabled();
  });

  it('shows retry control after exhaustion and fires onRetrySession', async () => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      exitInfo: {
        reason: 'exhausted',
        stage: 'execution_loop_exhausted',
        missionStatus: 'exhausted',
        at: '2025-10-09T19:10:00.000Z',
      },
      events: [
        {
          id: 'evt-1',
          createdAt: '2025-10-09T19:10:00.000Z',
          stage: 'execution_loop_exhausted',
          event: 'exhausted',
          role: 'assistant',
          label: 'Execution halted',
          description: 'Stopped after 3 attempts.',
          status: 'warning' as const,
          rawContent: 'Execution exhausted retry budget',
          metadata: { attempts: 3 },
        },
      ],
    });

    const onRetrySession = vi.fn();
    const user = userEvent.setup();

    renderPanel({
      onRetrySession,
    });

    const retryButton = await screen.findByRole('button', { name: /Retry mission/i });
    expect(retryButton).toBeEnabled();

    await user.click(retryButton);
    expect(onRetrySession).toHaveBeenCalledTimes(1);
  });

  it('surfaces reviewer handoff control and invokes callback with latest event', async () => {
    const escalationEvent = {
      id: 'evt-1',
      createdAt: '2025-10-09T19:00:00.000Z',
      stage: 'validator_reviewer_requested',
      event: 'reviewer_requested',
      role: 'assistant',
      label: 'Reviewer attention required',
      description: 'Validator escalated (ask_reviewer).',
      status: 'warning' as const,
      rawContent: 'Reviewer requested',
      metadata: { status: 'ask_reviewer', attempt: 2, tool_call_id: 'tool-123' },
    } satisfies UseTimelineEventsResult['events'][number];

    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      events: [escalationEvent],
    });

    const onReviewerRequested = vi.fn();
    const user = userEvent.setup();

    renderPanel({ onReviewerRequested });

    const headerButton = await screen.findByRole('button', {
      name: /Reviewer handoff/i,
    });
    expect(headerButton).toBeEnabled();

    await user.click(headerButton);

    expect(onReviewerRequested).toHaveBeenCalledTimes(1);
    expect(onReviewerRequested).toHaveBeenCalledWith(escalationEvent);
  });

  it('emits heartbeat telemetry with percentile payload', () => {
    const heartbeatSeries = [
      3.1,
      3.8,
      4.2,
      5.0,
      5.6,
      6.4,
      7.1,
      8.9,
      10.5,
      12.7,
    ];
    let callIndex = 0;

    useTimelineEventsMock.mockImplementation(() => {
      const value = heartbeatSeries[Math.min(callIndex, heartbeatSeries.length - 1)];
      callIndex += 1;
      return {
        ...baseHookResult,
        heartbeatSeconds: value,
        events: [
          {
            id: `evt-${callIndex}`,
            createdAt: `2025-10-09T19:${callIndex.toString().padStart(2, '0')}:00.000Z`,
            stage: 'executor_status',
            event: 'heartbeat_tick',
            role: 'assistant',
            label: 'Streaming heartbeat',
            description: 'Collecting heartbeat samples.',
            status: 'in_progress' as const,
            rawContent: 'tick',
            metadata: {},
          },
        ],
      } satisfies UseTimelineEventsResult;
    });

    const { rerender } = render(
      <StreamingStatusPanel
        tenantId={tenantId}
        agentId={agentId}
        sessionIdentifier={sessionIdentifier}
      />,
    );

    for (let index = 1; index < heartbeatSeries.length; index += 1) {
      rerender(
        <StreamingStatusPanel
          tenantId={tenantId}
          agentId={agentId}
          sessionIdentifier={sessionIdentifier}
        />,
      );
    }

    expect(sendTelemetryEventMock).toHaveBeenCalledWith(tenantId, {
      eventName: 'streaming_heartbeat_metrics',
      missionId: sessionIdentifier,
      eventData: expect.objectContaining({
        p50: expect.any(Number),
        p95: expect.any(Number),
        p99: expect.any(Number),
        sampleSize: heartbeatSeries.length,
      }),
    });

    const payload = sendTelemetryEventMock.mock.calls[0]?.[1]?.eventData as
      | { p50: number; p95: number; p99: number }
      | undefined;
    expect(payload).toBeDefined();
    expect(payload?.p50 ?? 0).toBeLessThanOrEqual(payload?.p95 ?? 0);
    expect(payload?.p95 ?? 0).toBeLessThanOrEqual(payload?.p99 ?? 0);
  });

  it('indicates monitoring pause without cancelling the mission', async () => {
    const refresh = vi.fn();
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      refresh,
      heartbeatSeconds: 3.5,
      events: [
        {
          id: 'evt-1',
          createdAt: '2025-10-09T19:00:00.000Z',
          stage: 'executor_status',
          event: 'toolkit_simulation',
          role: 'assistant',
          label: 'Toolkit simulation',
          description: 'Simulating sheets',
          status: 'in_progress' as const,
          rawContent: 'Simulating sheets toolkit',
          metadata: { toolkit: 'sheets' },
        },
      ],
    });

    const user = userEvent.setup();

    render(
      <StreamingStatusPanel
        tenantId={tenantId}
        agentId={agentId}
        sessionIdentifier={sessionIdentifier}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Pause/i }));

    expect(screen.getByText(/Monitoring paused/i)).toBeInTheDocument();
    expect(useTimelineEventsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(sendTelemetryEventMock).not.toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ eventName: 'session_cancelled' }),
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
