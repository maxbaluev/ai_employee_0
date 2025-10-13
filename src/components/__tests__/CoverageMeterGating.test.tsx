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
  readiness: 100,
  canProceed: true,
  summary: 'Ready to proceed',
  categories: [
    {
      id: 'toolkits',
      label: 'Toolkit coverage',
      coverage: 100,
      threshold: 85,
      status: 'pass',
      description: 'Recommended toolkit mix locked in.',
    },
    {
      id: 'artifacts',
      label: 'Evidence history',
      coverage: 80,
      threshold: 70,
      status: 'warn',
      description: 'Previous dry-run artifacts available for review.',
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
    previewState.readiness = 100;
    previewState.canProceed = true;
    previewState.summary = 'Ready to proceed';

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

    expect(screen.getByText(/^Toolkit coverage$/i)).toBeInTheDocument();
    expect(screen.getByText(/Select at least one mission toolkit/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request override/i })).toBeVisible();

    await new Promise((resolve) => setTimeout(resolve, 900));

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
        expect.objectContaining({ id: 'toolkits', status: 'fail' }),
        expect.objectContaining({ id: 'evidence', status: 'fail' }),
      ]),
    );
    expect(previewTelemetryCall?.[1].eventData?.toolkit_count).toBe(
      previewState.toolkits?.length ?? 0,
    );
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
        expect.objectContaining({ id: 'toolkits', status: 'pass' }),
        expect.objectContaining({ id: 'evidence', status: 'pass' }),
      ]),
    );
    expect(previewTelemetryCall?.[1].eventData?.toolkit_count).toBe(
      previewState.toolkits?.length ?? 0,
    );
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

    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText(/Coverage Gaps/i)).toBeInTheDocument();
    expect(screen.getByText(/No toolkits selected/i)).toBeInTheDocument();
    expect(screen.getByText(/Prior mission artifacts/i)).toBeInTheDocument();

    const footerMessage = screen
      .getAllByText(/^Insufficient toolkit coverage$/i)
      .find((node) => node.closest('footer')) as HTMLElement | undefined;
    expect(footerMessage).toBeDefined();

    const footer = footerMessage?.closest('footer') as HTMLElement;
    const recordButton = within(footer).getByRole('button', { name: /Record Inspection/i });
    expect(recordButton).toBeDisabled();
  });
});
