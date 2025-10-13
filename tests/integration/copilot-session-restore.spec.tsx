import { act, render, waitFor, screen, within } from '@testing-library/react';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MissionStageProvider } from '@/components/mission-stages';

import { ControlPlaneWorkspace } from '@/app/(control-plane)/ControlPlaneWorkspace';

vi.mock('@copilotkit/react-core', () => ({
  useCopilotReadable: vi.fn(),
  useCopilotAction: vi.fn(),
}));

vi.mock('@copilotkit/react-ui', () => ({
  CopilotSidebar: () => <aside aria-label="mocked-copilot" />,
}));

const fetchMock = vi.hoisted(() => vi.fn());

beforeAll(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => ({
    ok: true,
    json: async () => ({}),
  }));
});

function getStageNode(label: string) {
  const nav = screen.getByRole('navigation', { name: /mission stage progression/i });
  const items = within(nav).getAllByRole('listitem');
  const match = items.find((item) => within(item).queryByText(label));
  if (!match) {
    throw new Error(`Stage ${label} not found`);
  }
  return match as HTMLElement;
}

describe('Gate G-B CopilotKit session restore', () => {
  it('loads persisted session state on mount', async () => {
    await act(async () => {
      render(
        <MissionStageProvider tenantId="tenant-copilot" missionId={null}>
          <ControlPlaneWorkspace
            tenantId="tenant-copilot"
            initialObjectiveId={null}
            initialArtifacts={[]}
            catalogSummary={{ total_entries: 0, toolkits: 0, categories: [] }}
          />
        </MissionStageProvider>,
      );
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/copilotkit/session'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  it('hydrates mission stages persisted under a null objective', async () => {
    const hydrateSnapshot = {
      objectiveId: null,
      missionStages: {
        null: [
          { stage: 'intake', state: 'completed', startedAt: null, completedAt: '2024-01-01T00:00:00.000Z' },
          { stage: 'brief', state: 'active', startedAt: '2024-01-02T00:00:00.000Z', completedAt: null },
        ],
      },
    };

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input instanceof Request
              ? input.url
              : '';

      if (url.includes('/api/copilotkit/session')) {
        return {
          ok: true,
          json: async () => ({ state: hydrateSnapshot }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });

    await act(async () => {
      render(
        <MissionStageProvider tenantId="tenant-copilot" missionId="mission-resume">
          <ControlPlaneWorkspace
            tenantId="tenant-copilot"
            initialObjectiveId="mission-resume"
            initialArtifacts={[]}
            catalogSummary={{ total_entries: 0, toolkits: 0, categories: [] }}
          />
        </MissionStageProvider>,
      );
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/copilotkit/session'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    await waitFor(() => {
      expect(getStageNode('Brief').getAttribute('aria-current')).toBe('step');
    });

    expect(within(getStageNode('Intake')).getByText('✓')).toBeInTheDocument();
  });
});
