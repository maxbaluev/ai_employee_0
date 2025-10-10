/// <reference types="vitest" />

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UseTimelineEventsResult } from '@/hooks/useTimelineEvents';

const useTimelineEventsMock = vi.hoisted(
  () => vi.fn<[], UseTimelineEventsResult>(),
);

vi.mock('@/hooks/useTimelineEvents', () => ({
  useTimelineEvents: useTimelineEventsMock,
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

  beforeEach(() => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      refresh: vi.fn(),
    });
  });

  afterEach(() => {
    useTimelineEventsMock.mockReset();
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
});
