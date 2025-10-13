import { act, render } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ControlPlaneWorkspace } from '@/app/(control-plane)/ControlPlaneWorkspace';

const fetchMock = vi.hoisted(() => vi.fn());
const actionRegistry = vi.hoisted(() => ({ actions: [] as Array<{ name: string; handler: (args: any) => Promise<unknown> | unknown }> }));

vi.mock('@copilotkit/react-core', () => ({
  useCopilotReadable: vi.fn(),
  useCopilotAction: vi.fn((actionConfig: any) => {
    actionRegistry.actions.push(actionConfig);
    return actionConfig;
  }),
}));

vi.mock('@copilotkit/react-ui', () => ({
  CopilotSidebar: () => <aside aria-label="mocked-copilot" />,
}));

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
  actionRegistry.actions.length = 0;
});

describe('Gate G-B CopilotKit session exit determinism', () => {
  it('persists a single terminal message even if exit is invoked twice', async () => {
    await act(async () => {
      render(
        <ControlPlaneWorkspace
          tenantId="tenant-copilot"
          initialObjectiveId={null}
          initialArtifacts={[]}
          catalogSummary={{ total_entries: 0, toolkits: 0, categories: [] }}
        />,
      );
    });

    const exitAction = actionRegistry.actions.find((action) => action.name === 'copilotkit_exit');
    expect(exitAction).toBeDefined();

    const messageCallsBefore = fetchMock.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/api/copilotkit/message'),
    ).length;

    await act(async () => {
      await exitAction?.handler({ reason: 'completed' });
      await exitAction?.handler({ reason: 'completed' });
    });

    const messageCallsAfter = fetchMock.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/api/copilotkit/message'),
    ).length;

    expect(messageCallsAfter - messageCallsBefore).toBe(1);
  });
});
