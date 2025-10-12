import { render, waitFor } from '@testing-library/react';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('Gate G-B CopilotKit session restore', () => {
  it('loads persisted session state on mount', async () => {
    render(
      <ControlPlaneWorkspace
        tenantId="tenant-copilot"
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
  });
});
