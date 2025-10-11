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
      expect(within(getStageNode('Dry Run')).getByText('✓')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(getStageNode('Evidence').getAttribute('aria-current')).toBe('step');
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

describe('ControlPlaneWorkspace Evidence Gallery Stage 7 flow', () => {
  const tenantId = '00000000-0000-0000-0000-000000000000';
  const missionId = '11111111-1111-1111-1111-111111111111';

  describe('undo behavior', () => {
    it('renders artifacts with undo buttons when artifacts exist', async () => {
      const initialArtifacts = [
        {
          artifact_id: 'artifact-001',
          title: 'LinkedIn Campaign Draft',
          summary: 'Automated outreach sequence for warm leads',
          status: 'draft',
        },
        {
          artifact_id: 'artifact-002',
          title: 'Email Sequence Plan',
          summary: 'Follow-up campaign for Q4 prospects',
          status: 'pending',
        },
      ];

      render(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      // Evidence Gallery section should be visible
      const evidenceSection = screen.getByRole('heading', { name: /Evidence Gallery/i }).closest('section');
      expect(evidenceSection).toBeInTheDocument();

      // Both artifacts should be rendered
      expect(screen.getByText('LinkedIn Campaign Draft')).toBeInTheDocument();
      expect(screen.getByText('Email Sequence Plan')).toBeInTheDocument();

      // Each artifact should have an undo button
      const undoButtons = screen.getAllByRole('button', { name: /Undo draft/i });
      expect(undoButtons).toHaveLength(2);
    });

    it('calls evidence service API when undo button is clicked', async () => {
      const user = userEvent.setup();
      const initialArtifacts = [
        {
          artifact_id: 'artifact-rollback-123',
          title: 'Test Artifact',
          summary: 'This artifact should be rolled back',
          status: 'draft',
        },
      ];

      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url.includes('/api/undo')) {
          return Promise.resolve(
            new Response(JSON.stringify({ status: 'completed', message: 'Undo processed' }), {
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

      render(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const undoButton = screen.getByRole('button', { name: /Undo draft/i });
      await user.click(undoButton);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/undo',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
            body: expect.stringContaining('artifact-rollback-123'),
          }),
        );
      });
    });

    it('emits undo telemetry event when undo is requested', async () => {
      const user = userEvent.setup();
      const initialArtifacts = [
        {
          artifact_id: 'artifact-telemetry-test',
          title: 'Telemetry Test Artifact',
          summary: 'Testing undo telemetry',
          status: 'draft',
        },
      ];

      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url.includes('/api/undo')) {
          return Promise.resolve(
            new Response(JSON.stringify({ status: 'queued' }), {
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

      render(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const undoButton = screen.getByRole('button', { name: /Undo draft/i });
      await user.click(undoButton);

      await waitFor(() => {
        expect(telemetryMock).toHaveBeenCalledWith(
          tenantId,
          expect.objectContaining({
            eventName: 'undo_requested',
            missionId,
            eventData: expect.objectContaining({
              tool_call_id: 'artifact-telemetry-test',
              reason: 'User requested dry-run rollback',
            }),
          }),
        );
      });
    });

    it('displays success alert when undo completes successfully', async () => {
      const user = userEvent.setup();
      const initialArtifacts = [
        {
          artifact_id: 'artifact-success-test',
          title: 'Success Test Artifact',
          summary: 'Testing undo success message',
          status: 'draft',
        },
      ];

      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url.includes('/api/undo')) {
          return Promise.resolve(
            new Response(JSON.stringify({ status: 'completed' }), {
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

      render(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const undoButton = screen.getByRole('button', { name: /Undo draft/i });
      await user.click(undoButton);

      await waitFor(() => {
        expect(screen.getByText('Undo executed for the selected artifact.')).toBeInTheDocument();
      });
    });

    it('displays queued alert when undo is queued', async () => {
      const user = userEvent.setup();
      const initialArtifacts = [
        {
          artifact_id: 'artifact-queued-test',
          title: 'Queued Test Artifact',
          summary: 'Testing undo queued message',
          status: 'draft',
        },
      ];

      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url.includes('/api/undo')) {
          return Promise.resolve(
            new Response(JSON.stringify({ status: 'queued' }), {
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

      render(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const undoButton = screen.getByRole('button', { name: /Undo draft/i });
      await user.click(undoButton);

      await waitFor(() => {
        expect(screen.getByText('Undo request queued for evidence service.')).toBeInTheDocument();
      });
    });

    it('displays error alert when undo fails', async () => {
      const user = userEvent.setup();
      const initialArtifacts = [
        {
          artifact_id: 'artifact-error-test',
          title: 'Error Test Artifact',
          summary: 'Testing undo error handling',
          status: 'draft',
        },
      ];

      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url.includes('/api/undo')) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'Evidence service unavailable' }), {
              status: 503,
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

      render(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const undoButton = screen.getByRole('button', { name: /Undo draft/i });
      await user.click(undoButton);

      await waitFor(() => {
        expect(screen.getByText('Evidence service unavailable')).toBeInTheDocument();
      });
    });

    it('disables undo button while undo request is in progress', async () => {
      const user = userEvent.setup();
      const initialArtifacts = [
        {
          artifact_id: 'artifact-loading-test',
          title: 'Loading Test Artifact',
          summary: 'Testing undo loading state',
          status: 'draft',
        },
      ];

      let resolveUndo: (value: Response) => void;
      const undoPromise = new Promise<Response>((resolve) => {
        resolveUndo = resolve;
      });

      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url.includes('/api/undo')) {
          return undoPromise;
        }

        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      render(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const undoButton = screen.getByRole('button', { name: /Undo draft/i });
      expect(undoButton).not.toBeDisabled();

      await user.click(undoButton);

      // Button should be disabled and show loading text
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Undoing…/i })).toBeDisabled();
      });

      // Resolve the undo request
      resolveUndo!(
        new Response(JSON.stringify({ status: 'completed' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      // Button should be enabled again
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Undo draft/i });
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe('stage progression', () => {
    it('marks Evidence stage complete when artifacts are added during Evidence stage', async () => {
      const user = userEvent.setup();

      render(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={[]}
          catalogSummary={null}
        />,
      );

      // Progress through stages to reach Evidence
      await user.click(screen.getByRole('button', { name: /Complete Intake/i }));
      await user.click(screen.getByRole('button', { name: /Save Toolkit Selections/i }));
      await user.click(screen.getByRole('button', { name: /Complete Inspection/i }));
      await user.click(screen.getByRole('button', { name: /Select Planner Play/i }));

      // Wait for Evidence stage to be active
      await waitFor(() => {
        expect(getStageNode('Evidence').getAttribute('aria-current')).toBe('step');
      });

      // Add an artifact using the placeholder button
      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url.includes('/api/artifacts')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                artifact: {
                  id: 'artifact-new-123',
                  title: 'Approval summary placeholder',
                  content: { summary: 'Use the agent to replace this with a real dry-run asset.' },
                  status: 'draft',
                },
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      const addButton = screen.getByRole('button', { name: /Add Placeholder/i });
      await user.click(addButton);

      // Evidence stage should be marked complete
      await waitFor(() => {
        expect(within(getStageNode('Evidence')).getByText('✓')).toBeInTheDocument();
      });

      // Feedback stage should become active
      await waitFor(() => {
        expect(getStageNode('Feedback').getAttribute('aria-current')).toBe('step');
      });
    });

    it('auto-completes Evidence stage when workspace loads with existing artifacts', async () => {
      const initialArtifacts = [
        {
          artifact_id: 'artifact-existing',
          title: 'Pre-existing Artifact',
          summary: 'This artifact already exists',
          status: 'draft',
        },
      ];

      render(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const user = userEvent.setup();

      // Progress to Evidence stage
      await user.click(screen.getByRole('button', { name: /Complete Intake/i }));
      await user.click(screen.getByRole('button', { name: /Save Toolkit Selections/i }));
      await user.click(screen.getByRole('button', { name: /Complete Inspection/i }));
      await user.click(screen.getByRole('button', { name: /Select Planner Play/i }));

      // Wait for Evidence stage to auto-complete since artifacts exist
      await waitFor(() => {
        expect(within(getStageNode('Evidence')).getByText('✓')).toBeInTheDocument();
      });

      // Feedback stage should become active
      await waitFor(() => {
        expect(getStageNode('Feedback').getAttribute('aria-current')).toBe('step');
      });
    });

    it('emits stage completion telemetry when Evidence stage completes', async () => {
      const user = userEvent.setup();

      render(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={[]}
          catalogSummary={null}
        />,
      );

      // Progress through stages to reach Evidence
      await user.click(screen.getByRole('button', { name: /Complete Intake/i }));
      await user.click(screen.getByRole('button', { name: /Save Toolkit Selections/i }));
      await user.click(screen.getByRole('button', { name: /Complete Inspection/i }));
      await user.click(screen.getByRole('button', { name: /Select Planner Play/i }));

      await waitFor(() => {
        expect(getStageNode('Evidence').getAttribute('aria-current')).toBe('step');
      });

      telemetryMock.mockClear();

      // Add an artifact to trigger Evidence completion
      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url.includes('/api/artifacts')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                artifact: {
                  id: 'artifact-telemetry-123',
                  title: 'Test Artifact',
                  content: { summary: 'Testing stage telemetry' },
                  status: 'draft',
                },
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      await user.click(screen.getByRole('button', { name: /Add Placeholder/i }));

      await waitFor(() => {
        expect(telemetryMock).toHaveBeenCalledWith(
          tenantId,
          expect.objectContaining({
            eventName: 'stage_evidence_completed',
            missionId,
            eventData: expect.objectContaining({
              stage: 'evidence',
            }),
          }),
        );
      });

      // Should also emit feedback stage started event
      await waitFor(() => {
        expect(telemetryMock).toHaveBeenCalledWith(
          tenantId,
          expect.objectContaining({
            eventName: 'stage_feedback_started',
            missionId,
            eventData: expect.objectContaining({
              stage: 'feedback',
            }),
          }),
        );
      });
    });
  });

  describe('evidence gallery UI', () => {
    it('shows empty state when no artifacts exist', async () => {
      render(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={[]}
          catalogSummary={null}
        />,
      );

      expect(
        screen.getByText('Ask the agent to generate a draft artifact to populate this area.'),
      ).toBeInTheDocument();
    });

    it('displays artifact status badges correctly', async () => {
      const artifacts = [
        {
          artifact_id: 'artifact-draft',
          title: 'Draft Artifact',
          summary: 'A draft artifact',
          status: 'draft',
        },
        {
          artifact_id: 'artifact-pending',
          title: 'Pending Artifact',
          summary: 'A pending artifact',
          status: 'pending',
        },
        {
          artifact_id: 'artifact-approved',
          title: 'Approved Artifact',
          summary: 'An approved artifact',
          status: 'approved',
        },
      ];

      render(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={artifacts}
          catalogSummary={null}
        />,
      );

      expect(screen.getByText('draft')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('approved')).toBeInTheDocument();
    });

    it('renders artifact titles and summaries correctly', async () => {
      const artifacts = [
        {
          artifact_id: 'artifact-detailed',
          title: 'Campaign Strategy Document',
          summary: 'Comprehensive plan for Q4 outreach including timing, messaging, and target segments',
          status: 'draft',
        },
      ];

      render(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={artifacts}
          catalogSummary={null}
        />,
      );

      expect(screen.getByText('Campaign Strategy Document')).toBeInTheDocument();
      expect(
        screen.getByText('Comprehensive plan for Q4 outreach including timing, messaging, and target segments'),
      ).toBeInTheDocument();
    });
  });
});
