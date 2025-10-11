/// <reference types="vitest" />

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { makePlannerCandidateEvent, makePlannerRankCompleteEvent, makePlannerTelemetryRow } from './fixtures/plannerEvents';

import type { UseTimelineEventsResult } from '@/hooks/useTimelineEvents';

const useTimelineEventsMock = vi.hoisted(() => vi.fn<[], UseTimelineEventsResult>());
const sendTelemetryEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useTimelineEvents', () => ({
  useTimelineEvents: useTimelineEventsMock,
}));

vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: sendTelemetryEventMock,
}));

// Lazy import to ensure mocks are applied first.
const { PlannerInsightRail } = await import('../PlannerInsightRail');

const baseHookResult: UseTimelineEventsResult = {
  events: [],
  isLoading: false,
  error: null,
  refresh: vi.fn(),
  lastUpdated: '2025-10-10T17:15:00.000Z',
  exitInfo: null,
  heartbeatSeconds: 2.1,
  lastEventAt: '2025-10-10T17:15:00.000Z',
};

describe('PlannerInsightRail', () => {
  const tenantId = '00000000-0000-0000-0000-000000000000';
  const missionId = '11111111-1111-1111-1111-111111111111';
  const sessionIdentifier = 'mission-identifier-1';

  beforeEach(() => {
    useTimelineEventsMock.mockReturnValue(baseHookResult);
    sendTelemetryEventMock.mockReset();
  });

  it('renders ranked plays from planner timeline + telemetry and surfaces rationale', async () => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      events: [makePlannerRankCompleteEvent(), makePlannerCandidateEvent()],
    });

    render(
      <PlannerInsightRail
        tenantId={tenantId}
        missionId={missionId}
        sessionIdentifier={sessionIdentifier}
        plannerRuns={[makePlannerTelemetryRow()]}
        onSelectPlay={vi.fn()}
        onStageAdvance={vi.fn()}
      />,
    );

    const card = await screen.findByRole('article', {
      name: /Re-engage warm accounts/i,
    });

    expect(within(card).getByText(/High impact/i)).toBeInTheDocument();
    expect(
      within(card).getByText(/Undo plan: Provide draft outreach/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Planner latency/i)).toHaveTextContent('1.85s');
    expect(screen.getByText(/3 candidates/i)).toBeInTheDocument();
  });

  it('allows selecting a ranked play, emits telemetry, and forwards selection', async () => {
    const onSelectPlay = vi.fn();
    const onStageAdvance = vi.fn();

    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      events: [makePlannerRankCompleteEvent(), makePlannerCandidateEvent()],
    });

    const user = userEvent.setup();

    render(
      <PlannerInsightRail
        tenantId={tenantId}
        missionId={missionId}
        sessionIdentifier={sessionIdentifier}
        plannerRuns={[makePlannerTelemetryRow()]}
        onSelectPlay={onSelectPlay}
        onStageAdvance={onStageAdvance}
      />,
    );

    const selectButton = await screen.findByRole('button', {
      name: /Select this plan/i,
    });

    await user.click(selectButton);

    expect(onSelectPlay).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Re-engage warm accounts',
        impact: 'High',
        risk: 'Moderate',
        confidence: 0.78,
      }),
    );
    expect(onStageAdvance).toHaveBeenCalled();
  });

  it('surfaces empty state when planner has not streamed results yet', async () => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      events: [],
    });

    render(
      <PlannerInsightRail
        tenantId={tenantId}
        missionId={missionId}
        sessionIdentifier={sessionIdentifier}
        plannerRuns={[]}
        onSelectPlay={vi.fn()}
        onStageAdvance={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/Planner is ranking plays/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Select this plan/i }),
    ).not.toBeInTheDocument();
  });

  it('emits planner metrics telemetry when rank events stream in', async () => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      events: [makePlannerRankCompleteEvent()],
    });

    render(
      <PlannerInsightRail
        tenantId={tenantId}
        missionId={missionId}
        sessionIdentifier={sessionIdentifier}
        plannerRuns={[]}
        onSelectPlay={vi.fn()}
        onStageAdvance={vi.fn()}
      />,
    );

    expect(sendTelemetryEventMock).toHaveBeenCalledWith(tenantId, {
      eventName: 'planner_metrics_recorded',
      missionId,
      eventData: expect.objectContaining({
        latency_ms: 1850,
        candidate_count: 3,
        embedding_similarity_avg: 0.68,
        primary_toolkits: ['hubspot', 'gmail'],
      }),
    });
  });

  it('renders fallback planner stats from stored runs when timeline is empty', async () => {
    useTimelineEventsMock.mockReturnValue({
      ...baseHookResult,
      events: [],
    });

    render(
      <PlannerInsightRail
        tenantId={tenantId}
        missionId={missionId}
        sessionIdentifier={sessionIdentifier}
        plannerRuns={[makePlannerTelemetryRow()]}
        onSelectPlay={vi.fn()}
        onStageAdvance={vi.fn()}
      />,
    );

    expect(screen.getByText(/Planner latency:/i)).toHaveTextContent('1.85s');
    expect(screen.getByText(/3 candidates/i)).toBeInTheDocument();
    expect(screen.getByText(/Avg similarity:/i)).toHaveTextContent('0.68');
  });
});
