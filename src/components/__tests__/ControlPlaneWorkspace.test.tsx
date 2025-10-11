/// <reference types="vitest" />

import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@copilotkit/react-core', () => ({
  useCopilotReadable: vi.fn(),
  useCopilotAction: vi.fn(),
}));

vi.mock('@copilotkit/react-ui', () => ({
  CopilotSidebar: ({ children }: { children?: React.ReactNode }) => (
    <aside aria-label="Mock Copilot Sidebar">{children}</aside>
  ),
}));

const telemetryMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: telemetryMock,
}));

const missionIntakeMock = vi.hoisted(() =>
  vi.fn((props: { onAccept: (payload: any) => void; onStageAdvance?: () => void }) => (
    <section aria-label="Mock Mission Intake">
      <button
        type="button"
        onClick={() => {
          props.onAccept({
            missionId: '11111111-1111-1111-1111-111111111111',
            objective: 'Drive Q4 pipeline',
            audience: 'Revenue ops',
            guardrailSummary: 'Maintain professional tone',
            kpis: [],
            confidence: 0.74,
            source: 'gemini',
          });
          props.onStageAdvance?.();
        }}
      >
        Complete Intake
      </button>
    </section>
  )),
);

const recommendedToolkitsMock = vi.hoisted(() =>
  vi.fn((props: { onStageAdvance?: () => void }) => (
    <section aria-label="Mock Toolkit Stage">
      <button type="button" onClick={() => props.onStageAdvance?.()}>
        Save Toolkit Selections
      </button>
    </section>
  )),
);

const coverageMeterMock = vi.hoisted(() =>
  vi.fn((props: { onComplete: () => void }) => (
    <section aria-label="Mock Coverage Meter">
      <button type="button" onClick={props.onComplete}>
        Complete Inspection
      </button>
    </section>
  )),
);

const plannerSelectSpy = vi.fn();

const plannerInsightMock = vi.hoisted(() =>
  vi.fn(
    (props: {
      onSelectPlay?: (payload: any) => void;
      onStageAdvance?: () => void;
    }) => (
      <section aria-label="Mock Planner Insight">
        <button
          type="button"
          onClick={() => {
            plannerSelectSpy();
            props.onSelectPlay?.({
              title: 'Re-engage warm accounts',
              impact: 'High',
              risk: 'Moderate',
              confidence: 0.78,
              candidateIndex: 0,
              mode: 'dry_run',
            });
            props.onStageAdvance?.();
          }}
        >
          Select Planner Play
        </button>
      </section>
    ),
  ),
);

vi.mock('@/components/MissionIntake', () => ({
  MissionIntake: missionIntakeMock,
}));

vi.mock('@/components/RecommendedToolkits', () => ({
  RecommendedToolkits: recommendedToolkitsMock,
}));

vi.mock('@/components/CoverageMeter', () => ({
  CoverageMeter: coverageMeterMock,
}));

vi.mock('@/components/StreamingStatusPanel', () => ({
  StreamingStatusPanel: () => <aside aria-label="Mock Streaming Panel" />,
}));

vi.mock('@/components/PlannerInsightRail', () => ({
  PlannerInsightRail: plannerInsightMock,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  telemetryMock.mockReset();
  plannerSelectSpy.mockReset();

  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes('/api/copilotkit/session')) {
      return Promise.resolve(
        new Response(JSON.stringify({ sessionId: 'session-123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }

    if (url.includes('/api/copilotkit/message')) {
      return Promise.resolve(
        new Response(JSON.stringify({ messageId: 'msg-1', storedAt: new Date().toISOString() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }

    return Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const { ControlPlaneWorkspace } = await import('@/app/(control-plane)/ControlPlaneWorkspace');

function getStageNode(label: string) {
  const nav = screen.getByRole('navigation', { name: /mission stage progression/i });
  const allStages = within(nav).getAllByRole('listitem');
  const match = allStages.find((item) => within(item).queryByText(label));
  if (!match) {
    throw new Error(`Stage ${label} not found`);
  }
  const activeContainer = match.querySelector('[aria-current]');
  return (activeContainer as HTMLElement | null) ?? match;
}

describe('ControlPlaneWorkspace stage 5 flow', () => {
  const tenantId = '00000000-0000-0000-0000-000000000000';

  it('marks Plan stage complete and emits telemetry when planner selection occurs', async () => {
    const user = userEvent.setup();

    render(
      <ControlPlaneWorkspace
        tenantId={tenantId}
        initialObjectiveId={null}
        initialArtifacts={[]}
        catalogSummary={null}
      />,
    );

    const intakeStage = getStageNode('Intake');
    expect(intakeStage).toHaveAttribute('aria-current', 'step');

    await user.click(screen.getByRole('button', { name: /Complete Intake/i }));
    expect(within(getStageNode('Intake')).getByText('✓')).toBeInTheDocument();
    expect(within(getStageNode('Brief')).getByText('✓')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save Toolkit Selections/i }));
    expect(within(getStageNode('Toolkits')).getByText('✓')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Complete Inspection/i }));
    expect(within(getStageNode('Inspect')).getByText('✓')).toBeInTheDocument();

    const planStage = getStageNode('Plan');
    expect(planStage).toHaveAttribute('aria-current', 'step');

    await user.click(screen.getByRole('button', { name: /Select Planner Play/i }));

    expect(plannerSelectSpy).toHaveBeenCalled();

    await waitFor(() => {
      expect(getStageNode('Plan').getAttribute('aria-current')).not.toBe('step');
    });
    await waitFor(() => {
      expect(getStageNode('Dry Run').getAttribute('aria-current')).toBe('step');
    });

    expect(telemetryMock).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        eventName: 'plan_validated',
        missionId: '11111111-1111-1111-1111-111111111111',
        eventData: expect.objectContaining({
          selected_title: 'Re-engage warm accounts',
          candidate_index: 0,
          mode: 'dry_run',
        }),
      }),
    );
  });
});
vi.mock('@copilotkit/react-core', () => ({
  useCopilotReadable: vi.fn(),
  useCopilotAction: vi.fn(),
}));
