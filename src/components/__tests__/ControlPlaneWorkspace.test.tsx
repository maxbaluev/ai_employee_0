/// <reference types="vitest" />

import * as React from 'react';
import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MissionStage, MissionStageProvider, useMissionStages } from '@/components/mission-stages';
import type { ArtifactGalleryArtifact } from '@/components/ArtifactGallery';
import type { TimelineMessage } from '@/hooks/useTimelineEvents';

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
const clipboardWriteMockRef = vi.hoisted(() => ({ current: vi.fn() as vi.Mock }));

vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: telemetryMock,
}));

const missionIntakeMock = vi.hoisted(() =>
  vi.fn((props: { onAccept: (payload: unknown) => void; onStageAdvance?: () => void }) => (
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
  vi.fn(
    (props: {
      tenantId: string;
      missionId: string | null;
      selectedToolkitsCount: number;
      hasArtifacts: boolean;
      onComplete: () => void;
    }) => (
      <section aria-label="Mock Coverage Meter">
        <button type="button" onClick={props.onComplete}>
          Complete Inspection
        </button>
      </section>
    ),
  ),
);

const plannerSelectSpy = vi.fn();

const plannerInsightMock = vi.hoisted(() =>
  vi.fn(
    (props: {
      onSelectPlay?: (payload: unknown) => void;
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

type MockStreamingStatusPanelProps = {
  tenantId: string;
  agentId: string;
  sessionIdentifier: string | null | undefined;
  pollIntervalMs?: number;
  onReviewerRequested?: (event: unknown) => void;
  onPlanComplete?: () => void;
  onDryRunComplete?: () => void;
};

const streamingStatusPanelPropsRef = vi.hoisted(
  () => ({ current: null as MockStreamingStatusPanelProps | null }),
);

vi.mock('@/components/StreamingStatusPanel', () => {
  const StreamingStatusPanel = (props: MockStreamingStatusPanelProps) => {
    streamingStatusPanelPropsRef.current = props;
    return <aside aria-label="Mock Streaming Panel" />;
  };

  return { StreamingStatusPanel };
});

vi.mock('@/components/PlannerInsightRail', () => ({
  PlannerInsightRail: plannerInsightMock,
}));

type MockFeedbackSubmission = {
  rating: number | null;
  comment: string;
};

type MockFeedbackDrawerProps = {
  tenantId: string;
  missionId: string | null;
  currentStage: MissionStage;
  isOpen: boolean;
  selectedRating: number | null;
  onOpenChange?: (open: boolean) => void;
  onRatingChange?: (rating: number | null) => void;
  onSubmit?: (payload: MockFeedbackSubmission) => void;
};

const feedbackDrawerPropsRef = vi.hoisted(
  () => ({ current: null as MockFeedbackDrawerProps | null }),
);

vi.mock(
  '@/components/FeedbackDrawer',
  () => {
    const { useEffect, useRef, useState } = React;

    const FeedbackDrawer = (props: MockFeedbackDrawerProps) => {
      feedbackDrawerPropsRef.current = props;

      const [comment, setComment] = useState('');
      const textareaRef = useRef<HTMLTextAreaElement | null>(null);

      useEffect(() => {
        if (props.isOpen && textareaRef.current) {
          textareaRef.current.focus();
        }
      }, [props.isOpen]);

      const canRenderTrigger = props.currentStage === MissionStage.Evidence;

      return (
        <>
          {canRenderTrigger ? (
            <button
              type="button"
              onClick={() => props.onOpenChange?.(true)}
            >
              Open Feedback Drawer
            </button>
          ) : null}

          {props.isOpen ? (
            <aside
              role="dialog"
              aria-label="Feedback Drawer"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  props.onOpenChange?.(false);
                }
              }}
            >
              <div aria-label="Mission feedback rating">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    aria-label={`Rate mission ${score}`}
                    data-selected={props.selectedRating === score || undefined}
                    onClick={() => props.onRatingChange?.(score)}
                  >
                    {score}
                  </button>
                ))}
              </div>
              <textarea
                aria-label="Mission feedback comments"
                ref={textareaRef}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Close feedback drawer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    props.onSubmit?.({ rating: props.selectedRating, comment });
                    props.onOpenChange?.(false);
                  }}
                >
                  Send Feedback
                </button>
              </div>
            </aside>
          ) : null}
        </>
      );
    };

    return { FeedbackDrawer };
  },
  { virtual: true },
);

const fetchMock = vi.fn();

beforeEach(() => {
  telemetryMock.mockReset();
  plannerSelectSpy.mockReset();
  feedbackDrawerPropsRef.current = null;
  streamingStatusPanelPropsRef.current = null;

  clipboardWriteMockRef.current = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWriteMockRef.current },
    configurable: true,
  });
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:mock-url'),
    configurable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
  });
  Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
    value: vi.fn(),
    configurable: true,
  });

  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes('/api/feedback/submit')) {
      let parsedBody: Record<string, unknown> = {};
      if (init && typeof init.body === 'string') {
        try {
          parsedBody = JSON.parse(init.body) as Record<string, unknown>;
        } catch (error) {
          console.warn('Failed to parse feedback payload in test mock', error);
        }
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            feedback: {
              id: 'feedback-001',
              missionId: parsedBody.missionId ?? null,
              rating: parsedBody.rating ?? null,
            },
          }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    }

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

    if (url.includes('/api/missions/') && url.includes('/brief')) {
      return Promise.resolve(
        new Response(JSON.stringify({ brief: null }), {
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
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'clipboard');
  Reflect.deleteProperty(URL as unknown as Record<string, unknown>, 'createObjectURL');
  Reflect.deleteProperty(URL as unknown as Record<string, unknown>, 'revokeObjectURL');
  Reflect.deleteProperty(HTMLAnchorElement.prototype as unknown as Record<string, unknown>, 'click');
});

const { ControlPlaneWorkspace } = await import('@/app/(control-plane)/ControlPlaneWorkspace');

async function renderWithAct(ui: React.ReactElement) {
  await act(async () => {
    render(ui);
  });
}

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

async function advanceToEvidenceStage(user: ReturnType<typeof userEvent.setup>) {
  await advanceToPlanStage(user);
  await user.click(screen.getByRole('button', { name: 'Select Planner Play' }));

  await waitFor(() => {
    expect(streamingStatusPanelPropsRef.current?.onPlanComplete).toBeDefined();
  });

  act(() => {
    streamingStatusPanelPropsRef.current?.onPlanComplete?.();
  });

  await waitFor(() => {
    expect(streamingStatusPanelPropsRef.current?.onDryRunComplete).toBeDefined();
  });

  act(() => {
    streamingStatusPanelPropsRef.current?.onDryRunComplete?.();
  });

  await waitFor(() => {
    expect(within(getStageNode('Dry Run')).getByText('✓')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(getStageNode('Evidence').getAttribute('aria-current')).toBe('step');
  });
}

async function advanceToPlanStage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Complete Intake' }));
  await user.click(screen.getByRole('button', { name: 'Save Toolkit Selections' }));
  await user.click(screen.getByRole('button', { name: 'Complete Inspection' }));

  await waitFor(() => {
    expect(getStageNode('Plan').getAttribute('aria-current')).toBe('step');
  });
}

function StageFailureHarness({
  stage,
  metadata,
}: {
  stage: MissionStage;
  metadata?: Record<string, unknown>;
}) {
  const { markStageStarted, markStageFailed, stages } = useMissionStages();

  return (
    <div>
      <button type="button" onClick={() => markStageStarted(stage)}>
        Start Stage
      </button>
      <button type="button" onClick={() => markStageFailed(stage, metadata)}>
        Fail Stage
      </button>
      <div data-testid="failure-state">{stages.get(stage)?.state ?? 'unknown'}</div>
    </div>
  );
}

describe('ControlPlaneWorkspace stage 5 flow', () => {
  it('emits mission telemetry with updated missionId immediately after intake', async () => {
    const user = userEvent.setup();
    telemetryMock.mockReset();

    await renderWithAct(
      <ControlPlaneWorkspace
        tenantId={tenantId}
        initialObjectiveId={null}
        initialArtifacts={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Complete Intake' }));

    await waitFor(() => {
      const pinnedCall = telemetryMock.mock.calls.find(([, payload]) => {
        return payload.eventName === 'mission_brief_pinned';
      });

      expect(pinnedCall).toBeDefined();
      const [tenantArg, payload] = pinnedCall!;
      expect(tenantArg).toBe(tenantId);
      expect(payload).toEqual(
        expect.objectContaining({
          eventName: 'mission_brief_pinned',
          missionId: '11111111-1111-1111-1111-111111111111',
        }),
      );
    });
  });

  const tenantId = '00000000-0000-0000-0000-000000000000';

  it('marks Plan stage complete and emits telemetry when planner selection occurs', async () => {
    const user = userEvent.setup();

    await renderWithAct(
      <ControlPlaneWorkspace
        tenantId={tenantId}
        initialObjectiveId={null}
        initialArtifacts={[]}
        catalogSummary={null}
      />,
    );

    const intakeStage = getStageNode('Intake');
    expect(intakeStage).toHaveAttribute('aria-current', 'step');

    await user.click(screen.getByRole('button', { name: 'Complete Intake' }));
    expect(within(getStageNode('Intake')).getByText('✓')).toBeInTheDocument();
    expect(within(getStageNode('Brief')).getByText('✓')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save Toolkit Selections' }));
    expect(within(getStageNode('Toolkits')).getByText('✓')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Complete Inspection' }));
    expect(within(getStageNode('Inspect')).getByText('✓')).toBeInTheDocument();

    const planStage = getStageNode('Plan');
    expect(planStage).toHaveAttribute('aria-current', 'step');

  await user.click(screen.getByRole('button', { name: 'Select Planner Play' }));

    expect(plannerSelectSpy).toHaveBeenCalled();

    await waitFor(() => {
      expect(getStageNode('Plan').getAttribute('aria-current')).not.toBe('step');
    });

    const dryRunStage = getStageNode('Dry Run');
    expect(dryRunStage).toHaveAttribute('aria-current', 'step');
    expect(within(dryRunStage).queryByText('✓')).not.toBeInTheDocument();

    const evidenceStage = getStageNode('Evidence');
    expect(evidenceStage.getAttribute('aria-current')).not.toBe('step');

    await waitFor(() => {
      expect(streamingStatusPanelPropsRef.current?.onPlanComplete).toBeDefined();
    });

    act(() => {
      streamingStatusPanelPropsRef.current?.onPlanComplete?.();
    });

    await waitFor(() => {
      expect(streamingStatusPanelPropsRef.current?.onDryRunComplete).toBeDefined();
    });

    act(() => {
      streamingStatusPanelPropsRef.current?.onDryRunComplete?.();
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

describe('ControlPlaneWorkspace Gate G-B gating', () => {
  const tenantId = '00000000-0000-0000-0000-000000000000';

  it('keeps Dry Run active (not completed) immediately after plan selection', async () => {
    const user = userEvent.setup();

    await renderWithAct(
      <ControlPlaneWorkspace
        tenantId={tenantId}
        initialObjectiveId={null}
        initialArtifacts={[]}
        catalogSummary={null}
      />,
    );

    await advanceToPlanStage(user);
    await user.click(screen.getByRole('button', { name: 'Select Planner Play' }));

    const dryRunStage = getStageNode('Dry Run');
    await waitFor(() => {
      expect(dryRunStage).toHaveAttribute('aria-current', 'step');
    });

    expect(within(dryRunStage).queryByText('✓')).not.toBeInTheDocument();

    const evidenceStage = getStageNode('Evidence');
    expect(evidenceStage.getAttribute('aria-current')).not.toBe('step');
  });

  it('completes Dry Run only after StreamingStatusPanel exit callback is invoked', async () => {
    const user = userEvent.setup();

    await renderWithAct(
      <ControlPlaneWorkspace
        tenantId={tenantId}
        initialObjectiveId={null}
        initialArtifacts={[]}
        catalogSummary={null}
      />,
    );

    await advanceToPlanStage(user);
    await user.click(screen.getByRole('button', { name: 'Select Planner Play' }));

    const dryRunStage = getStageNode('Dry Run');
    await waitFor(() => {
      expect(dryRunStage).toHaveAttribute('aria-current', 'step');
    });

    expect(within(dryRunStage).queryByText('✓')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(streamingStatusPanelPropsRef.current?.onPlanComplete).toBeDefined();
    });

    act(() => {
      streamingStatusPanelPropsRef.current?.onPlanComplete?.();
    });

    await waitFor(() => {
      expect(streamingStatusPanelPropsRef.current?.onDryRunComplete).toBeDefined();
    });

    act(() => {
      streamingStatusPanelPropsRef.current?.onDryRunComplete?.();
    });

    await waitFor(() => {
      expect(within(getStageNode('Dry Run')).getByText('✓')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getStageNode('Evidence').getAttribute('aria-current')).toBe('step');
    });
  });

  it('marks Feedback stage as current when the drawer is opened', async () => {
    const user = userEvent.setup();

    await renderWithAct(
      <ControlPlaneWorkspace
        tenantId={tenantId}
        initialObjectiveId={null}
        initialArtifacts={[]}
        catalogSummary={null}
      />,
    );

    await advanceToEvidenceStage(user);

    await waitFor(() => {
      expect(feedbackDrawerPropsRef.current).not.toBeNull();
      expect(feedbackDrawerPropsRef.current?.isOpen).toBe(false);
    });

    const addPlaceholderButton = await screen.findByRole('button', { name: 'Add Placeholder' });
    await user.click(addPlaceholderButton);

    await waitFor(() => {
      expect(within(getStageNode('Evidence')).getByText('✓')).toBeInTheDocument();
    });

    act(() => {
      feedbackDrawerPropsRef.current?.onOpenChange?.(true);
    });

    await waitFor(() => {
      expect(feedbackDrawerPropsRef.current?.isOpen).toBe(true);
    });

    await waitFor(() => {
      expect(getStageNode('Feedback').getAttribute('aria-current')).toBe('step');
    });
  });
});

describe('ControlPlaneWorkspace mission brief integration', () => {
  const tenantId = '00000000-0000-0000-0000-000000000000';

  it('renders Mission Brief card after intake acceptance', async () => {
    const user = userEvent.setup();

    await renderWithAct(
      <ControlPlaneWorkspace
        tenantId={tenantId}
        initialObjectiveId={null}
        initialArtifacts={[]}
        catalogSummary={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Complete Intake' }));

    expect(await screen.findByRole('heading', { name: /Mission Brief/i })).toBeInTheDocument();
    expect(screen.getByText('Drive Q4 pipeline')).toBeInTheDocument();

    await waitFor(() => {
      expect(telemetryMock).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ eventName: 'mission_brief_updated' }),
      );
    });
  });

  it('renders Mission Brief card when mission brief fetch resolves', async () => {
    const missionIdentifier = '99999999-9999-9999-9999-999999999999';
    const baseFetch = fetchMock.getMockImplementation();

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes(`/api/missions/${missionIdentifier}/brief`)) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              brief: {
                objective: 'Fetched mission objective',
                audience: 'Fetched audience',
                kpis: [],
                safeguards: [],
                confidence: { objective: 0.6 },
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      }

      return baseFetch
        ? baseFetch(input, init)
        : Promise.resolve(
            new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
    });

    await renderWithAct(
      <ControlPlaneWorkspace
        tenantId={tenantId}
        initialObjectiveId={missionIdentifier}
        initialArtifacts={[]}
        catalogSummary={null}
      />,
    );

    expect(await screen.findByRole('heading', { name: /Mission Brief/i })).toBeInTheDocument();
    expect(screen.getByText('Fetched mission objective')).toBeInTheDocument();

    await waitFor(() => {
      expect(telemetryMock).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ eventName: 'mission_brief_loaded' }),
      );
    });
  });
});

describe('ControlPlaneWorkspace copilot session persistence', () => {
  const tenantId = '00000000-0000-0000-0000-000000000000';

  it('does not overwrite persisted snapshot during hydration', async () => {
    const persistedSnapshot = {
      artifacts: [
        {
          artifact_id: 'persisted-artifact-001',
          title: 'Persisted Draft',
          summary: 'Existing artifact from previous session',
          status: 'draft',
        },
      ],
      objectiveId: '11111111-1111-1111-1111-111111111111',
      themeColor: '#123456',
      missionBrief: {
        missionId: '11111111-1111-1111-1111-111111111111',
        objective: 'Persisted objective',
        audience: 'Persisted audience',
        kpis: [],
        safeguards: [{ hintType: 'tone', text: 'Keep tone warm-professional' }],
        confidence: { objective: 0.9 },
        source: 'persisted',
      },
      safeguards: [
        {
          id: 'safeguard-1',
          label: 'Keep tone warm-professional',
          hintType: 'tone',
          status: 'accepted',
          confidence: 0.82,
        },
      ],
      safeguardHistory: [
        {
          id: 'history-1',
          label: 'Keep tone warm-professional',
          status: 'accepted',
          timestamp: '2025-10-10T10:00:00.000Z',
        },
      ],
      plannerRuns: [
        {
          id: 'planner-run-1',
          stage: 'planner_rank_complete',
          event: 'completed',
          createdAt: '2025-10-10T10:05:00.000Z',
          label: 'Planner ranked plays',
          description: 'Persisted planner output',
          metadata: { candidate_count: 3 },
        },
      ],
      selectedFeedbackRating: 5,
    } satisfies Record<string, unknown>;

    const baseFetch = fetchMock.getMockImplementation();
    const postBodies: Record<string, unknown>[] = [];
    const requestOrder: string[] = [];

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/api/copilotkit/session')) {
        if (method === 'GET') {
          requestOrder.push('GET');
          return Promise.resolve(
            new Response(JSON.stringify({ state: persistedSnapshot }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }

        requestOrder.push('POST');
        if (init?.body) {
          try {
            postBodies.push(JSON.parse(init.body as string) as Record<string, unknown>);
          } catch (error) {
            postBodies.push({ parseError: String(error) });
          }
        }

        return Promise.resolve(
          new Response(JSON.stringify({ sessionId: 'session-123' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      return baseFetch ? baseFetch(input, init) : Promise.resolve(new Response('{}', { status: 200 }));
    });

    try {
      await renderWithAct(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={null}
          initialArtifacts={[]}
          catalogSummary={null}
        />,
      );

      await waitFor(() => {
        expect(requestOrder).toContain('GET');
      });

      await waitFor(() => {
        expect(postBodies.length).toBeGreaterThan(0);
      });

      const firstPost = postBodies[0] as { state?: Record<string, unknown> };
      expect(firstPost?.state).toBeDefined();
      expect(firstPost?.state).toMatchObject({
        artifacts: persistedSnapshot.artifacts,
        missionBrief: persistedSnapshot.missionBrief,
        safeguards: persistedSnapshot.safeguards,
        plannerRuns: persistedSnapshot.plannerRuns,
      });
    } finally {
      fetchMock.mockImplementation(baseFetch);
    }
  });
});

describe('ControlPlaneWorkspace Feedback Drawer integration', () => {
  const tenantId = '00000000-0000-0000-0000-000000000000';
  const missionId = '11111111-1111-1111-1111-111111111111';

  async function renderWorkspace(initialArtifacts: ArtifactGalleryArtifact[] = []) {
    await renderWithAct(
      <ControlPlaneWorkspace
        tenantId={tenantId}
        initialObjectiveId={null}
        initialArtifacts={initialArtifacts}
        catalogSummary={null}
      />,
    );
  }

  it('renders feedback drawer trigger once Evidence stage is active', async () => {
    const user = userEvent.setup();
    await renderWorkspace();

    expect(screen.queryByRole('button', { name: 'Open Feedback Drawer' })).not.toBeInTheDocument();

    await advanceToEvidenceStage(user);

    const trigger = await screen.findByRole('button', { name: 'Open Feedback Drawer' });
    expect(trigger).toBeInTheDocument();

    await waitFor(() => {
      expect(feedbackDrawerPropsRef.current).not.toBeNull();
      expect(feedbackDrawerPropsRef.current?.isOpen).toBe(false);
      expect(typeof feedbackDrawerPropsRef.current?.onOpenChange).toBe('function');
    });
  });

  it('opens feedback drawer, focuses comments field, and closes on Escape', async () => {
    const user = userEvent.setup();
    await renderWorkspace();

    await advanceToEvidenceStage(user);

    const trigger = await screen.findByRole('button', { name: 'Open Feedback Drawer' });
    await user.click(trigger);

    const drawer = await screen.findByRole('dialog', { name: /Feedback Drawer/i });
    expect(drawer).toBeInTheDocument();

    const commentsField = screen.getByRole('textbox', { name: /Mission feedback comments/i });
    await waitFor(() => {
      expect(commentsField).toHaveFocus();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Feedback Drawer/i })).not.toBeInTheDocument();
      expect(feedbackDrawerPropsRef.current?.isOpen).toBe(false);
    });
  });

  it('renders safeguard drawer and Accept All emits telemetry', async () => {
    const user = userEvent.setup();
    await renderWorkspace();

    await advanceToEvidenceStage(user);

    const drawer = await screen.findByLabelText('Safeguard Drawer');
    expect(drawer).toBeInTheDocument();

    telemetryMock.mockClear();

    const acceptAllButton = within(drawer).getByRole('button', { name: 'Accept All' });
    await user.click(acceptAllButton);

    await waitFor(() => {
      expect(telemetryMock).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ eventName: 'safeguard_hint_accept_all' }),
      );
    });
  });

  it('submits mission feedback via API, records telemetry, and keeps Feedback stage current', async () => {
    const user = userEvent.setup();
    await renderWorkspace([
      {
        artifact_id: 'artifact-initial-001',
        title: 'Initial Evidence',
        summary: 'Seed artifact to activate evidence stage',
        status: 'draft',
      },
    ]);

    await advanceToEvidenceStage(user);

    const trigger = await screen.findByRole('button', { name: 'Open Feedback Drawer' });
    await user.click(trigger);

    await waitFor(() => {
      expect(feedbackDrawerPropsRef.current?.isOpen).toBe(true);
    }).catch(() => {
      act(() => {
        feedbackDrawerPropsRef.current?.onOpenChange?.(true);
      });
    });

    await waitFor(() => {
      expect(feedbackDrawerPropsRef.current?.isOpen).toBe(true);
    });

    await waitFor(() => {
      expect(getStageNode('Feedback').getAttribute('aria-current')).toBe('step');
    });

    await user.click(await screen.findByRole('button', { name: 'Rate mission 5' }));

    const commentsField = screen.getByRole('textbox', { name: /Mission feedback comments/i });
    await user.type(commentsField, 'Great mission support');

    await user.click(screen.getByRole('button', { name: 'Send Feedback' }));

    await waitFor(() => {
      expect(telemetryMock).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          eventName: 'feedback_submitted',
          missionId,
          eventData: expect.objectContaining({
            rating: 5,
            comment: 'Great mission support',
          }),
        }),
      );
    });

    await waitFor(() => {
      const submitCall = fetchMock.mock.calls.find(([request]) => {
        if (typeof request === 'string') {
          return request.includes('/api/feedback/submit');
        }
        if (request instanceof URL) {
          return request.toString().includes('/api/feedback/submit');
        }
        if (request && typeof (request as Request).url === 'string') {
          return (request as Request).url.includes('/api/feedback/submit');
        }
        return false;
      });
      expect(submitCall).toBeDefined();
      const [, options] = submitCall!;
      expect(options).toMatchObject({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      });

      const body = options?.body;
      expect(typeof body).toBe('string');
      const parsed = JSON.parse(body as string);
      expect(parsed).toMatchObject({
        missionId,
        rating: 5,
        feedbackText: 'Great mission support',
      });
      expect(parsed.learningSignals).toMatchObject({
        source: 'control_plane_feedback_drawer',
        has_comment: true,
        rating: 5,
      });
      expect(parsed.learningSignals.comment_length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(feedbackDrawerPropsRef.current?.isOpen).toBe(false);
    });

    await waitFor(
      () => {
        expect(getStageNode('Feedback').getAttribute('aria-current')).toBe('step');
      },
      { timeout: 3000 },
    );
  });
});

describe('ControlPlaneWorkspace reviewer integration', () => {
  const tenantId = '00000000-0000-0000-0000-000000000000';
  const missionId = '11111111-1111-1111-1111-111111111111';

  it('passes safeguards into ApprovalModal and approval submission payload', async () => {
    const user = userEvent.setup();
    const baseFetch = fetchMock.getMockImplementation();
    let capturedApprovalPayload: Record<string, unknown> | null = null;

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url === '/api/approvals') {
        if (init && typeof init.body === 'string') {
          try {
            capturedApprovalPayload = JSON.parse(init.body) as Record<string, unknown>;
          } catch {
            capturedApprovalPayload = null;
          }
        }

        return Promise.resolve(
          new Response(
            JSON.stringify({
              approval: {
                id: 'approval-001',
                decision: 'approved',
                missionId,
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      }

      return baseFetch
        ? baseFetch(input, init)
        : Promise.resolve(
            new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
    });

    await renderWithAct(
      <ControlPlaneWorkspace
        tenantId={tenantId}
        initialObjectiveId={null}
        initialArtifacts={[]}
        catalogSummary={null}
      />,
    );

    await advanceToPlanStage(user);

    await waitFor(() => {
      expect(streamingStatusPanelPropsRef.current?.onReviewerRequested).toBeDefined();
    });

    const reviewerEvent: TimelineMessage = {
      id: 'timeline-event-reviewer-001',
      label: 'Validator requested reviewer',
      description: 'Manual reviewer decision required.',
      status: 'warning',
      stage: 'validator_reviewer_requested',
      createdAt: new Date().toISOString(),
      metadata: {
        tool_call_id: 'tool-call-123',
        attempt: 1,
      },
    };

    act(() => {
      streamingStatusPanelPropsRef.current?.onReviewerRequested?.(reviewerEvent);
    });

    const modal = await screen.findByRole('dialog', { name: /validator reviewer requested/i });

    await waitFor(() => {
      expect(within(modal).getByText('Active safeguards')).toBeInTheDocument();
      expect(within(modal).getByText('Maintain professional tone')).toBeInTheDocument();
    });

    await user.click(within(modal).getByRole('button', { name: 'Submit decision' }));

    await waitFor(() => {
      expect(capturedApprovalPayload).not.toBeNull();
      expect(capturedApprovalPayload).toMatchObject({
        tenantId,
        missionId,
        toolCallId: 'tool-call-123',
        decision: 'approved',
        safeguards: [
          expect.objectContaining({
            type: 'unspecified',
            value: 'Maintain professional tone',
            pinned: false,
          }),
        ],
      });
    });

    await waitFor(() => {
      expect(telemetryMock).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          eventName: 'approval_decision',
          eventData: expect.objectContaining({
            safeguards_count: 1,
            has_safeguards: true,
          }),
        }),
      );
    });
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

      await renderWithAct(
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
      const undoButton = screen.getByRole('button', {
        name: 'Undo draft for LinkedIn Campaign Draft',
      });
      expect(undoButton).toBeInTheDocument();
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

      await renderWithAct(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const undoButton = screen.getByRole('button', { name: 'Undo draft for Test Artifact' });
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

      await renderWithAct(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const undoButton = screen.getByRole('button', { name: 'Undo draft for Telemetry Test Artifact' });
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

      await renderWithAct(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const undoButton = screen.getByRole('button', { name: 'Undo draft for Success Test Artifact' });
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

      await renderWithAct(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const undoButton = screen.getByRole('button', { name: 'Undo draft for Queued Test Artifact' });
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

      await renderWithAct(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const undoButton = screen.getByRole('button', { name: 'Undo draft for Error Test Artifact' });
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

      await renderWithAct(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const undoButton = screen.getByRole('button', { name: 'Undo draft for Loading Test Artifact' });
      expect(undoButton).not.toBeDisabled();

      await user.click(undoButton);

      // Button should be disabled and show loading text
      await waitFor(() => {
        const loadingButton = screen.getByRole('button', {
          name: 'Undo draft for Loading Test Artifact',
        });
        expect(loadingButton).toBeDisabled();
        expect(loadingButton).toHaveTextContent('Undoing…');
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
        const button = screen.getByRole('button', { name: 'Undo draft for Loading Test Artifact' });
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe('stage progression', () => {
    it('marks Evidence stage complete when artifacts are added during Evidence stage', async () => {
      const user = userEvent.setup();

      await renderWithAct(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={[]}
          catalogSummary={null}
        />,
      );

      await advanceToEvidenceStage(user);

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

      const addButton = screen.getByRole('button', { name: 'Add Placeholder' });
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

      await renderWithAct(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={initialArtifacts}
          catalogSummary={null}
        />,
      );

      const user = userEvent.setup();

      await advanceToEvidenceStage(user);

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

      await renderWithAct(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={[]}
          catalogSummary={null}
        />,
      );

      await advanceToEvidenceStage(user);

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

      await user.click(screen.getByRole('button', { name: 'Add Placeholder' }));

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

    it('emits stage completion telemetry across Inspect through Feedback', async () => {
      const user = userEvent.setup();
      const baseFetch = fetchMock.getMockImplementation();

      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url.includes('/api/artifacts')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                artifact: {
                  id: 'artifact-telemetry-flow',
                  title: 'Telemetry Flow Artifact',
                  content: { summary: 'Completing evidence stage' },
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

        return baseFetch
          ? baseFetch(input, init)
          : Promise.resolve(
              new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            );
      });

      await renderWithAct(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={[]}
          catalogSummary={null}
        />,
      );

      telemetryMock.mockClear();

      await advanceToEvidenceStage(user);

      await user.click(screen.getByRole('button', { name: 'Add Placeholder' }));

      await waitFor(() => {
        expect(within(getStageNode('Evidence')).getByText('✓')).toBeInTheDocument();
        expect(getStageNode('Feedback').getAttribute('aria-current')).toBe('step');
      });

      await waitFor(() => {
        expect(feedbackDrawerPropsRef.current).not.toBeNull();
      });

      act(() => {
        feedbackDrawerPropsRef.current?.onOpenChange?.(true);
      });

      act(() => {
        feedbackDrawerPropsRef.current?.onRatingChange?.(5);
      });

      await act(async () => {
        await feedbackDrawerPropsRef.current?.onSubmit?.({
          rating: 5,
          comment: 'Telemetry flow validation',
        });
      });

      await waitFor(() => {
        expect(within(getStageNode('Feedback')).getByText('✓')).toBeInTheDocument();
      });

      const expectedEvents = [
        'stage_inspect_completed',
        'stage_plan_completed',
        'stage_dry_run_completed',
        'stage_evidence_completed',
        'stage_feedback_completed',
      ];

      expectedEvents.forEach((eventName) => {
        const call = telemetryMock.mock.calls.find(([, payload]) => payload.eventName === eventName);
        expect(call).toBeDefined();
        expect(call?.[0]).toBe(tenantId);
        expect(call?.[1]).toMatchObject({
          missionId,
          eventData: expect.objectContaining({
            duration: expect.any(Number),
          }),
        });
      });

      if (baseFetch) {
        fetchMock.mockImplementation(baseFetch);
      }
    });
  });

  describe('evidence gallery UI', () => {
    it('shows empty state when no artifacts exist', async () => {
      await renderWithAct(
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

      await renderWithAct(
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

      await renderWithAct(
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

  describe('artifact actions', () => {
    it('renders export and share buttons that trigger handlers', async () => {
      const user = userEvent.setup();
      const artifacts = [
        {
          artifact_id: 'artifact-actions',
          title: 'Action Artifact',
          summary: 'Contains draft outputs',
          status: 'draft',
        },
      ];

      const baseFetch = fetchMock.getMockImplementation();
      const exportResponse = new Response('csv-data', {
        status: 200,
        headers: { 'Content-Type': 'text/csv' },
      });
      const shareResponse = new Response(JSON.stringify({ shareUrl: 'https://example.com/share' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/artifacts/export')) {
          expect(init?.method).toBe('POST');
          return Promise.resolve(exportResponse);
        }
        if (url.includes('/api/artifacts/share')) {
          expect(init?.method).toBe('POST');
          return Promise.resolve(shareResponse);
        }
        return baseFetch
          ? baseFetch(input, init)
          : Promise.resolve(
              new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );
      });

      clipboardWriteMockRef.current.mockClear();
      telemetryMock.mockClear();

      await renderWithAct(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={artifacts}
          catalogSummary={null}
        />,
      );

      await user.click(
        screen.getByRole('button', { name: 'Download Action Artifact as CSV' }),
      );
      await user.click(
        screen.getByRole('button', { name: 'Copy share link for Action Artifact' }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/artifacts/share'),
          expect.objectContaining({ method: 'POST' }),
        );
      });

      expect(
        await screen.findByText('Share link copied to clipboard.'),
      ).toBeInTheDocument();
    });

    it('renders truncated evidence hash and emits telemetry when copied', async () => {
      const user = userEvent.setup();
      const hash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const artifacts = [
        {
          artifact_id: 'artifact-hash',
          title: 'Hashed Artifact',
          summary: 'Includes evidence hash',
          status: 'draft',
          evidence_hash: hash,
        },
      ];

      telemetryMock.mockClear();
      clipboardWriteMockRef.current.mockClear();

      await renderWithAct(
        <ControlPlaneWorkspace
          tenantId={tenantId}
          initialObjectiveId={missionId}
          initialArtifacts={artifacts}
          catalogSummary={null}
        />,
      );

      const hashElement = await screen.findByTitle(hash);
      expect(hashElement).toHaveTextContent('1234567890…abcdef');

      await user.click(screen.getByRole('button', { name: 'Copy evidence SHA-256 hash' }));

      await waitFor(() => {
        expect(telemetryMock).toHaveBeenCalledWith(
          tenantId,
          expect.objectContaining({
            eventName: 'evidence_hash_copied',
            eventData: expect.objectContaining({
              artifact_id: 'artifact-hash',
              hash_length: hash.length,
            }),
          }),
        );
      });

      expect(
        await screen.findByText('Evidence hash copied to clipboard.'),
      ).toBeInTheDocument();
    });
  });
});

describe('MissionStageProvider failure path', () => {
  const tenantId = '00000000-0000-0000-0000-000000000000';
  const missionId = '22222222-2222-2222-2222-222222222222';

  it('marks the stage as failed and emits failure telemetry with metadata', async () => {
    const user = userEvent.setup();
    telemetryMock.mockClear();

    await renderWithAct(
      <MissionStageProvider tenantId={tenantId} missionId={missionId}>
        <StageFailureHarness
          stage={MissionStage.Plan}
          metadata={{ reason: 'planner_error', error_code: 'PLAN_FAIL' }}
        />
      </MissionStageProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Start Stage' }));
    await user.click(screen.getByRole('button', { name: 'Fail Stage' }));

    await waitFor(() => {
      expect(screen.getByTestId('failure-state')).toHaveTextContent('failed');
    });

    const failureCall = telemetryMock.mock.calls.find(([, payload]) => payload.eventName === 'stage_plan_failed');
    expect(failureCall).toBeDefined();
    expect(failureCall?.[1].eventData).toMatchObject({
      stage: 'plan',
      reason: 'planner_error',
      error_code: 'PLAN_FAIL',
    });
  });
});
