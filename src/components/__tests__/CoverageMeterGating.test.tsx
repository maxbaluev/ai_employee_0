/// <reference types="vitest" />

import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoverageMeter } from '../CoverageMeter';

vi.mock('@copilotkit/react-core', () => ({
  useCopilotReadable: vi.fn(),
  useCopilotAction: vi.fn(),
}));

vi.mock('@copilotkit/react-ui', () => ({
  CopilotSidebar: ({ children }: { children?: ReactNode }) => (
    <aside aria-label="Mock Copilot Sidebar">{children}</aside>
  ),
}));

const telemetryMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: telemetryMock,
}));

function findLastTelemetryEvent(eventName: string) {
  const reversed = [...telemetryMock.mock.calls].reverse();
  return reversed.find(([, payload]) => payload?.eventName === eventName);
}

function countTelemetryEvents(eventName: string) {
  return telemetryMock.mock.calls.filter(([, payload]) => payload?.eventName === eventName).length;
}

type MissionIntakeAcceptPayload = {
  missionId: string;
};

const missionIntakeMock = vi.hoisted(() =>
  vi.fn(
    (props: { onAccept: (payload: MissionIntakeAcceptPayload) => void; onStageAdvance?: () => void }) => (
      <section aria-label="Mock Mission Intake Stage">
        <button
          type="button"
          onClick={() => {
            props.onAccept({
              missionId: '22222222-2222-2222-2222-222222222222',
            });
            props.onStageAdvance?.();
          }}
        >
          Complete Intake
        </button>
      </section>
    ),
  ),
);

const recommendedToolkitsMock = vi.hoisted(() =>
  vi.fn(
    (props: { onStageAdvance?: () => void; onSelectionChange?: (count: number) => void }) => (
      <section aria-label="Mock Recommended Toolkits Stage">
        <button type="button" onClick={() => props.onSelectionChange?.(2)}>
          Select Toolkits
        </button>
        <button
          type="button"
          onClick={() => {
            props.onSelectionChange?.(2);
            props.onStageAdvance?.();
          }}
        >
          Complete Toolkits Stage
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

vi.mock('@/components/StreamingStatusPanel', () => ({
  StreamingStatusPanel: () => <aside aria-label="Mock Streaming Panel" />,
}));

vi.mock('@/components/PlannerInsightRail', () => ({
  PlannerInsightRail: () => <section aria-label="Mock Planner Insight Rail" />,
}));

vi.mock('@/components/ApprovalModal', () => ({
  ApprovalModal: () => null,
}));

const fetchMock = vi.fn();

type PreviewState = {
  readiness: number;
  canProceed: boolean;
  summary: string;
  categories: Array<{
    id: string;
    label: string;
    coverage: number;
    threshold: number;
    status: 'pass' | 'fail' | 'warn';
    description?: string;
  }>;
  gate: {
    threshold: number;
    canProceed: boolean;
    reason: string;
    overrideAvailable: boolean;
  };
  toolkits?: Array<{ slug: string; name: string; sampleCount?: number }>;
};

const previewState = vi.hoisted<PreviewState>(() => ({
  readiness: 92,
  canProceed: true,
  summary: 'Inspection readiness meets threshold.',
  categories: [
    {
      id: 'objectives',
      label: 'Objectives & KPIs',
      coverage: 96,
      threshold: 85,
      status: 'pass',
      description: 'Objective, audience, and KPIs accepted.',
    },
    {
      id: 'safeguards',
      label: 'Safeguards',
      coverage: 78,
      threshold: 80,
      status: 'warn',
      description: 'Review safeguard hints and accept updates.',
    },
    {
      id: 'plays',
      label: 'Planner Plays',
      coverage: 74,
      threshold: 80,
      status: 'warn',
      description: 'Planner run pinned with viable plays.',
    },
    {
      id: 'datasets',
      label: 'Datasets & Evidence',
      coverage: 52,
      threshold: 70,
      status: 'fail',
      description: 'Attach datasets or evidence artifacts before planning.',
    },
  ],
  gate: {
    threshold: 85,
    canProceed: true,
    reason: 'Inspection readiness meets threshold.',
    overrideAvailable: false,
  },
  toolkits: [
    { slug: 'hubspot-crm', name: 'HubSpot CRM', sampleCount: 3 },
    { slug: 'slack', name: 'Slack', sampleCount: 2 },
  ],
}));

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

describe('CoverageMeter gating integration', () => {
  const tenantId = '00000000-0000-0000-0000-000000000000';
  const defaultArtifacts = [
    {
      artifact_id: 'artifact-existing',
      title: 'Existing Draft',
      summary: 'Prior dry-run artifact to satisfy readiness factor.',
      status: 'draft',
    },
  ];

  beforeEach(() => {
    previewState.readiness = 92;
    previewState.canProceed = true;
    previewState.summary = 'Inspection readiness meets threshold.';
    previewState.categories = [
      {
        id: 'objectives',
        label: 'Objectives & KPIs',
        coverage: 96,
        threshold: 85,
        status: 'pass',
        description: 'Objective, audience, and KPIs accepted.',
      },
      {
        id: 'safeguards',
        label: 'Safeguards',
        coverage: 78,
        threshold: 80,
        status: 'warn',
        description: 'Review safeguard hints and accept updates.',
      },
      {
        id: 'plays',
        label: 'Planner Plays',
        coverage: 74,
        threshold: 80,
        status: 'warn',
        description: 'Planner run pinned with viable plays.',
      },
      {
        id: 'datasets',
        label: 'Datasets & Evidence',
        coverage: 52,
        threshold: 70,
        status: 'fail',
        description: 'Attach datasets or evidence artifacts before planning.',
      },
    ];
    previewState.gate = {
      threshold: 85,
      canProceed: true,
      reason: 'Inspection readiness meets threshold.',
      overrideAvailable: false,
    };

    telemetryMock.mockReset();
    missionIntakeMock.mockClear();
    recommendedToolkitsMock.mockClear();
    fetchMock.mockReset();

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes('/api/inspect/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(previewState), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      if (url.includes('/api/copilotkit/session')) {
        return Promise.resolve(
          new Response(JSON.stringify({ sessionId: 'session-abc' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      if (url.includes('/api/copilotkit/message')) {
        return Promise.resolve(
          new Response(JSON.stringify({ messageId: 'msg-abc', storedAt: new Date().toISOString() }), {
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

  it('keeps Plan stage locked when inspection readiness is below threshold', async () => {
    const user = userEvent.setup();
    previewState.readiness = 82;
    previewState.canProceed = false;
    previewState.summary = 'Inspection requires additional coverage';
    previewState.gate = {
      threshold: 85,
      canProceed: false,
      reason: 'Coverage below inspection requirement.',
      overrideAvailable: true,
    };
    previewState.categories = [
      {
        id: 'objectives',
        label: 'Objectives & KPIs',
        coverage: 88,
        threshold: 85,
        status: 'pass',
        description: 'Objective, audience, and KPIs accepted.',
      },
      {
        id: 'safeguards',
        label: 'Safeguards',
        coverage: 68,
        threshold: 80,
        status: 'warn',
        description: 'Approve at least one safeguard hint before proceeding.',
      },
      {
        id: 'plays',
        label: 'Planner Plays',
        coverage: 42,
        threshold: 80,
        status: 'fail',
        description: 'Generate and pin a planner play before continuing.',
      },
      {
        id: 'datasets',
        label: 'Datasets & Evidence',
        coverage: 38,
        threshold: 70,
        status: 'fail',
        description: 'Attach datasets or evidence artifacts before planning.',
      },
    ];

    render(
      <ControlPlaneWorkspace
        tenantId={tenantId}
        initialObjectiveId={null}
        initialArtifacts={defaultArtifacts}
        catalogSummary={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Complete Intake/i }));
    await user.click(screen.getByRole('button', { name: /Select Toolkits/i }));
    await user.click(screen.getByRole('button', { name: /Complete Toolkits Stage/i }));

    const recordButton = await screen.findByRole('button', { name: /Record Inspection/i });
    await waitFor(() => expect(recordButton).toBeEnabled());

    fetchMock.mockClear();
    telemetryMock.mockClear();

    await user.click(recordButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/inspect/preview'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const previewCall = fetchMock.mock.calls.find(([request]) =>
      (typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url).includes(
        '/api/inspect/preview',
      ),
    );

    expect(previewCall).toBeDefined();
    const [, previewInit] = previewCall ?? [];
    expect(previewInit?.method).toBe('POST');

    const parsedBody =
      typeof previewInit?.body === 'string' ? JSON.parse(previewInit.body) : null;
    expect(parsedBody).not.toBeNull();
    expect(parsedBody).toMatchObject({
      missionId: '22222222-2222-2222-2222-222222222222',
      tenantId,
      findingType: 'coverage_preview',
    });

    expect(parsedBody?.payload).toMatchObject({
      selectedToolkitsCount: 2,
      hasArtifacts: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const inspectStage = getStageNode('Inspect');
    expect(inspectStage).toHaveAttribute('aria-current', 'step');
    expect(within(inspectStage).queryByText('✓')).not.toBeInTheDocument();

    const planStage = getStageNode('Plan');
    expect(planStage).not.toHaveAttribute('aria-current', 'step');
    expect(within(planStage).queryByText('✓')).not.toBeInTheDocument();

    const previewTelemetryCall = telemetryMock.mock.calls.find(([, payload]) =>
      typeof payload === 'object' &&
      typeof payload?.eventName === 'string' &&
      /inspect.*preview/i.test(payload.eventName) &&
      payload.eventData?.readiness === previewState.readiness,
    );

    expect(previewTelemetryCall).toBeDefined();
    expect(previewTelemetryCall?.[1].eventData?.gate?.canProceed).toBe(false);
    expect(previewTelemetryCall?.[1].eventData?.gate?.threshold).toBe(85);
    expect(previewTelemetryCall?.[1].eventData?.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'plays', status: 'fail' }),
        expect.objectContaining({ id: 'datasets', status: 'fail' }),
      ]),
    );
    expect(previewTelemetryCall?.[1].eventData?.toolkit_count).toBe(
      previewState.toolkits?.length ?? 0,
    );

    await waitFor(() => expect(findLastTelemetryEvent('inspection_coverage_viewed')).toBeDefined());
    const coverageEvent = findLastTelemetryEvent('inspection_coverage_viewed');
    const coverageData = coverageEvent?.[1].eventData;
    expect(coverageData?.bucketCounts).toEqual({ pass: 1, warn: 1, fail: 2 });
    expect(coverageData?.canProceed).toBe(false);
    expect(coverageData?.selectedToolkitsCount).toBe(2);

    const playsCategory = screen
      .getAllByText('Planner Plays')
      .map((node) => node.closest('li'))
      .find(Boolean) as HTMLElement | undefined;
    expect(playsCategory?.className).toContain('border-red-500/30');

    const datasetsCategory = screen
      .getAllByText('Datasets & Evidence')
      .map((node) => node.closest('li'))
      .find(Boolean) as HTMLElement | undefined;
    expect(datasetsCategory?.className).toContain('border-red-500/30');

    const safeguardsCategory = screen
      .getAllByText('Safeguards')
      .map((node) => node.closest('li'))
      .find(Boolean) as HTMLElement | undefined;
    expect(safeguardsCategory?.className).toContain('border-amber-500/30');
  });

  it('advances to Plan when inspection readiness meets threshold', async () => {
    const user = userEvent.setup();
    previewState.readiness = 92;
    previewState.canProceed = true;
    previewState.summary = 'Inspection clears gating threshold';
    previewState.gate = {
      threshold: 85,
      canProceed: true,
      reason: 'Inspection readiness meets threshold.',
      overrideAvailable: false,
    };
    // Keep the categories from beforeEach, which already have the right mix:
    // objectives: pass, safeguards: warn, plays: warn, datasets: fail

    render(
      <ControlPlaneWorkspace
        tenantId={tenantId}
        initialObjectiveId={null}
        initialArtifacts={defaultArtifacts}
        catalogSummary={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Complete Intake/i }));
    await user.click(screen.getByRole('button', { name: /Select Toolkits/i }));
    await user.click(screen.getByRole('button', { name: /Complete Toolkits Stage/i }));

    const recordButton = await screen.findByRole('button', { name: /Record Inspection/i });
    await waitFor(() => expect(recordButton).toBeEnabled());

    fetchMock.mockClear();
    telemetryMock.mockClear();

    await user.click(recordButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/inspect/preview'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const previewCall = fetchMock.mock.calls.find(([request]) =>
      (typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url).includes(
        '/api/inspect/preview',
      ),
    );

    expect(previewCall).toBeDefined();
    const [, previewInit] = previewCall ?? [];
    expect(previewInit?.method).toBe('POST');

    const parsedBody =
      typeof previewInit?.body === 'string' ? JSON.parse(previewInit.body) : null;
    expect(parsedBody).not.toBeNull();
    expect(parsedBody).toMatchObject({
      missionId: '22222222-2222-2222-2222-222222222222',
      tenantId,
      findingType: 'coverage_preview',
    });

    expect(parsedBody?.payload).toMatchObject({
      selectedToolkitsCount: 2,
      hasArtifacts: true,
    });

    await waitFor(
      () => {
        expect(within(getStageNode('Inspect')).getByText('✓')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    await waitFor(
      () => {
        expect(getStageNode('Plan')).toHaveAttribute('aria-current', 'step');
      },
      { timeout: 2000 },
    );

    const previewTelemetryCall = telemetryMock.mock.calls.find(([, payload]) =>
      typeof payload === 'object' &&
      typeof payload?.eventName === 'string' &&
      /inspect.*preview/i.test(payload.eventName) &&
      payload.eventData?.readiness === previewState.readiness,
    );

    expect(previewTelemetryCall).toBeDefined();
    expect(previewTelemetryCall?.[1].eventData?.gate?.canProceed).toBe(true);
    expect(previewTelemetryCall?.[1].eventData?.gate?.threshold).toBe(85);
    expect(previewTelemetryCall?.[1].eventData?.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'plays', status: 'warn' }),
        expect.objectContaining({ id: 'datasets', status: 'fail' }),
      ]),
    );
    expect(previewTelemetryCall?.[1].eventData?.toolkit_count).toBe(
      previewState.toolkits?.length ?? 0,
    );

    await waitFor(() => expect(findLastTelemetryEvent('inspection_coverage_viewed')).toBeDefined());
    const coverageEvent = findLastTelemetryEvent('inspection_coverage_viewed');
    const coverageData = coverageEvent?.[1].eventData;
    expect(coverageData?.bucketCounts).toEqual({ pass: 1, warn: 2, fail: 1 });
    expect(coverageData?.canProceed).toBe(true);

    const objectivesCategory = screen.getByText('Objectives & KPIs').closest('li');
    expect(objectivesCategory?.className).toContain('border-emerald-500/30');

    const playsCategoryWarn = screen.getByText('Planner Plays').closest('li');
    expect(playsCategoryWarn?.className).toContain('border-amber-500/30');

    const datasetsCategoryFail = screen.getByText('Datasets & Evidence').closest('li');
    expect(datasetsCategoryFail?.className).toContain('border-red-500/30');
  });

  it('blocks the inspection proceed button when readiness is below threshold and surfaces gap guidance', () => {
    render(
      <CoverageMeter
        tenantId="tenant-low-readiness"
        missionId="mission-low-readiness"
        selectedToolkitsCount={0}
        hasArtifacts={false}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText('Inspection pending')).toBeInTheDocument();
    expect(
      screen.getByText('Run an inspection preview to calculate coverage and surface gaps.'),
    ).toBeInTheDocument();

    const recordButton = screen.getByRole('button', { name: /Record Inspection/i });
    expect(recordButton).toBeDisabled();
  });

  it('respects telemetry deduplication and does not emit duplicate inspection_coverage_viewed events', async () => {
    const { rerender } = render(
      <CoverageMeter
        tenantId="tenant-signature"
        missionId="mission-signature"
        selectedToolkitsCount={1}
        hasArtifacts={false}
        onComplete={vi.fn()}
      />,
    );

    await waitFor(() => expect(findLastTelemetryEvent('inspection_coverage_viewed')).toBeDefined());
    expect(countTelemetryEvents('inspection_coverage_viewed')).toBe(1);

    rerender(
      <CoverageMeter
        tenantId="tenant-signature"
        missionId="mission-signature"
        selectedToolkitsCount={1}
        hasArtifacts={false}
        onComplete={vi.fn()}
      />,
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(countTelemetryEvents('inspection_coverage_viewed')).toBe(1);

    rerender(
      <CoverageMeter
        tenantId="tenant-signature"
        missionId="mission-signature"
        selectedToolkitsCount={2}
        hasArtifacts={false}
        onComplete={vi.fn()}
      />,
    );

    await waitFor(() => expect(countTelemetryEvents('inspection_coverage_viewed')).toBe(1));
  });

  it('correctly styles categories with warn status (amber)', async () => {
    render(
      <CoverageMeter
        tenantId="tenant-warn"
        missionId="mission-warn"
        selectedToolkitsCount={1}
        hasArtifacts
        onComplete={vi.fn()}
      />,
    );

    await waitFor(() => expect(findLastTelemetryEvent('inspection_coverage_viewed')).toBeDefined());
    const coverageEvent = findLastTelemetryEvent('inspection_coverage_viewed');
    const coverageData = coverageEvent?.[1].eventData;
    expect(coverageData?.bucketCounts).toEqual({ pass: 1, warn: 2, fail: 1 });

    const safeguardsCategoryWarn = screen
      .getAllByText('Safeguards')
      .map((node) => node.closest('li'))
      .find(Boolean) as HTMLElement | undefined;
    expect(safeguardsCategoryWarn?.className).toContain('border-amber-500/30');
  });
});
