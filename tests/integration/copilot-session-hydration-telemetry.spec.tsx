import { render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ControlPlaneWorkspace } from '@/app/(control-plane)/ControlPlaneWorkspace';

const telemetryMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('@copilotkit/react-core', () => ({
  useCopilotReadable: vi.fn(),
  useCopilotAction: vi.fn(() => ({ name: 'mock', description: 'mock', parameters: [] })),
}));

vi.mock('@copilotkit/react-ui', () => ({
  CopilotSidebar: () => <aside aria-label="mocked-copilot" />,
}));

vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: (...args: unknown[]) => telemetryMock(...args),
}));

const sessionSnapshot = {
  artifacts: [],
  objectiveId: 'mission-hydrated',
  missionStages: [
    { stage: 'intake', state: 'completed' },
    { stage: 'brief', state: 'completed' },
    { stage: 'toolkits', state: 'pending' },
    { stage: 'inspect', state: 'pending' },
    { stage: 'plan', state: 'pending' },
    { stage: 'dry_run', state: 'pending' },
    { stage: 'evidence', state: 'pending' },
    { stage: 'feedback', state: 'pending' },
  ],
};

beforeAll(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  telemetryMock.mockReset();

  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input, init: RequestInit | undefined = undefined) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = init?.method ?? (typeof input === 'string' ? 'GET' : input.method ?? 'GET');

    if (url.includes('/api/copilotkit/session') && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ state: sessionSnapshot }),
      } as Response;
    }

    return {
      ok: true,
      json: async () => ({}),
    } as Response;
  });
});

describe('Gate G-B Copilot session hydration telemetry regression', () => {
  it('does not emit duplicate stage telemetry or advance pending stages on hydration', async () => {
    render(
      <ControlPlaneWorkspace
        tenantId="tenant-hydration"
        initialObjectiveId={null}
        initialArtifacts={[]}
        catalogSummary={{ total_entries: 0, toolkits: 0, categories: [] }}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/copilotkit/session'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    const stageEvents = telemetryMock.mock.calls.filter(([, payload]) => {
      const eventName = (payload as { eventName?: string } | undefined)?.eventName;
      return typeof eventName === 'string' && eventName.startsWith('stage_');
    });

    expect(stageEvents).toHaveLength(0);

    const toolkitsStageLabel = await screen.findByText('Toolkits');
    const inspectStageLabel = await screen.findByText('Inspect');

    const toolkitsBadge = toolkitsStageLabel
      .closest('li')
      ?.querySelector('span[aria-hidden="true"]');
    const inspectBadge = inspectStageLabel
      .closest('li')
      ?.querySelector('span[aria-hidden="true"]');

    expect(toolkitsBadge?.textContent).toBe('○');
    expect(inspectBadge?.textContent).toBe('○');
  });
});
