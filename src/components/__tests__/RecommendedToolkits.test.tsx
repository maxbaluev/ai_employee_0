/// <reference types="vitest" />

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RecommendedToolkits } from '../RecommendedToolkits';

const sendTelemetryEventMock = vi.hoisted(() => vi.fn());
const useCopilotReadableMock = vi.hoisted(() => vi.fn());

const originalFetch = globalThis.fetch;
const originalOpen = globalThis.open;

vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: sendTelemetryEventMock,
}));

vi.mock('@copilotkit/react-core', () => ({
  useCopilotReadable: useCopilotReadableMock,
}));

describe('RecommendedToolkits', () => {
  const tenantId = '6b81fd7e-4c54-439c-a9ab-8c958c1abf8a';
  const missionId = 'd28c1e4e-1a18-4c4c-93ef-9f7e0d9363a6';

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    sendTelemetryEventMock.mockReset();
    useCopilotReadableMock.mockReset();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.open = originalOpen;
    vi.restoreAllMocks();
  });

  function mockToolkitLoad(overrides: Partial<Record<string, unknown>> = {}) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        toolkits: [
          {
            name: 'HubSpot CRM',
            slug: 'hubspot_crm',
            description: 'Sync contacts and companies for coverage checks.',
            category: 'CRM',
            no_auth: true,
            auth_schemes: [],
            logo: null,
          },
          {
            name: 'Clearbit',
            slug: 'clearbit',
            description: 'Enrich accounts for inspection preview.',
            category: 'Data Enrichment',
            no_auth: false,
            auth_schemes: ['oauth'],
            logo: null,
          },
        ],
        selected: [],
        ...overrides,
      }),
    } as Response);
  }

  it('blocks advancement until at least one toolkit is selected', async () => {
    const alertSpy = vi.fn();
    const stageAdvanceSpy = vi.fn();

    mockToolkitLoad();

  render(
    <RecommendedToolkits
      tenantId={tenantId}
      missionId={missionId}
      onAlert={alertSpy}
      onStageAdvance={stageAdvanceSpy}
    />,
  );

    await screen.findByText('Recommended Tools');

    const saveButton = screen.getByRole('button', { name: /Save \(0\)/i });
    await userEvent.click(saveButton);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith({
      tone: 'error',
      message: expect.stringContaining('Select at least one toolkit'),
    });
    expect(stageAdvanceSpy).not.toHaveBeenCalled();
  });

  it('persists selections via /api/toolkits/selections and emits telemetry', async () => {
    const alertSpy = vi.fn();
    const stageAdvanceSpy = vi.fn();

    mockToolkitLoad();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        selections: [
          {
            id: 'selection-1',
            tenantId,
            missionId,
            toolkitId: 'hubspot_crm',
            authMode: 'none',
            connectionStatus: 'not_required',
            undoToken: 'token-123',
            metadata: { name: 'HubSpot CRM', category: 'CRM', noAuth: true },
          },
        ],
      }),
    } as Response);

    render(
      <RecommendedToolkits
        tenantId={tenantId}
        missionId={missionId}
        onAlert={alertSpy}
        onStageAdvance={stageAdvanceSpy}
      />,
    );

    await screen.findByText('Recommended Tools');

    const firstCard = screen.getByText('HubSpot CRM');
    await userEvent.click(firstCard);

    const saveButton = screen.getByRole('button', { name: /Save \(1\)/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const [, postCall] = fetchMock.mock.calls;
    expect(postCall?.[0]).toBe('/api/toolkits/selections');
    expect(JSON.parse(postCall?.[1]?.body as string)).toEqual({
      missionId,
      tenantId,
      selections: [
        expect.objectContaining({
          slug: 'hubspot_crm',
          name: 'HubSpot CRM',
          noAuth: true,
        }),
      ],
    });

    expect(stageAdvanceSpy).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith({
      tone: 'success',
      message: expect.stringContaining('Saved 1 toolkit'),
    });
    expect(sendTelemetryEventMock).toHaveBeenCalledWith(tenantId, {
      eventName: 'toolkit_selected',
      missionId,
      eventData: expect.objectContaining({
        selected_count: 1,
        selection_slugs: ['hubspot_crm'],
      }),
    });
  });

  it('opens Connect Link modal and completes OAuth flow', async () => {
    const alertSpy = vi.fn();

    mockToolkitLoad();

    const authorizationUrl = 'https://connect.composio.dev/oauth';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authorizationUrl, state: 'state-token', expiresAt: new Date().toISOString() }),
    } as Response);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        connections: [
          {
            toolkit: 'clearbit',
            status: 'linked',
            connectionId: 'con_123',
          },
        ],
      }),
    } as Response);

    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => null);

    render(
      <RecommendedToolkits
        tenantId={tenantId}
        missionId={missionId}
        onAlert={alertSpy}
      />,
    );

    await screen.findByText('Clearbit');

    const connectButton = screen.getByRole('button', { name: /Connect Clearbit/i });
    await userEvent.click(connectButton);

    const modal = await screen.findByRole('dialog', { name: /Connect Clearbit/i });
    expect(modal).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(1); // initial toolkit load only

    const launchButton = screen.getByRole('button', { name: /Launch Connect Link/i });
    await userEvent.click(launchButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const [, connectCall, pollCall] = fetchMock.mock.calls;
    expect(connectCall?.[0]).toBe('/api/composio/connect');
    const connectPayload = JSON.parse(connectCall?.[1]?.body as string);
    expect(connectPayload).toMatchObject({
      mode: 'init',
      tenantId,
      missionId,
      provider: 'composio',
      toolkitSlug: 'clearbit',
    });

    expect(openSpy).toHaveBeenCalledWith(authorizationUrl, '_blank', 'noopener');

    expect(pollCall?.[0]).toContain('/api/toolkits/connections');

    expect(sendTelemetryEventMock).toHaveBeenNthCalledWith(1, tenantId, {
      eventName: 'connect_link_launched',
      missionId,
      eventData: expect.objectContaining({ toolkit_slug: 'clearbit' }),
    });

    expect(sendTelemetryEventMock).toHaveBeenNthCalledWith(2, tenantId, {
      eventName: 'connect_link_completed',
      missionId,
      eventData: expect.objectContaining({
        toolkit_slug: 'clearbit',
        connection_id: 'con_123',
      }),
    });

    expect(alertSpy).toHaveBeenCalledWith({
      tone: 'success',
      message: expect.stringContaining('Clearbit successfully linked'),
    });
  });

  it('supports keyboard navigation and selection using arrow keys + space', async () => {
    const alertSpy = vi.fn();
    const stageAdvanceSpy = vi.fn();

    mockToolkitLoad();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        selections: [
          {
            id: 'selection-1',
            tenantId,
            missionId,
            toolkitId: 'clearbit',
            authMode: 'oauth',
            connectionStatus: 'not_linked',
            undoToken: 'token-xyz',
            metadata: { name: 'Clearbit', category: 'Data Enrichment', noAuth: false },
          },
        ],
      }),
    } as Response);

    render(
      <RecommendedToolkits
        tenantId={tenantId}
        missionId={missionId}
        onAlert={alertSpy}
        onStageAdvance={stageAdvanceSpy}
      />,
    );

    await screen.findByText('Recommended Tools');

    const firstToolkit = screen.getByTestId('toolkit-toggle-hubspot_crm');
    firstToolkit.focus();
    expect(firstToolkit).toHaveFocus();

    fireEvent.keyDown(firstToolkit, { key: 'ArrowRight' });

    const secondToolkit = screen.getByTestId('toolkit-toggle-clearbit');
    expect(secondToolkit).toHaveFocus();

    fireEvent.keyDown(secondToolkit, { key: ' ' });

    await screen.findByRole('button', { name: /Save \(1\)/i });

    const saveButton = screen.getByRole('button', { name: /Save \(1\)/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(stageAdvanceSpy).toHaveBeenCalled();
    expect(sendTelemetryEventMock).toHaveBeenCalledWith(tenantId, {
      eventName: 'toolkit_selected',
      missionId,
      eventData: expect.objectContaining({
        selected_count: 1,
        selection_slugs: ['clearbit'],
      }),
    });
  });

  it('hydrates selection state from API selectionDetails payload', async () => {
    const selectionChangeSpy = vi.fn();

    mockToolkitLoad({
      selectionDetails: [
        {
          slug: 'hubspot_crm',
          metadata: { name: 'HubSpot CRM', category: 'CRM', noAuth: true },
          authMode: 'none',
          connectionStatus: 'not_required',
          undoToken: 'token-seeded',
        },
      ],
    });

    render(
      <RecommendedToolkits
        tenantId={tenantId}
        missionId={missionId}
        onSelectionChange={selectionChangeSpy}
      />,
    );

    await screen.findByText('Recommended Tools');

    expect(selectionChangeSpy).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: /Save \(1\)/i })).toBeInTheDocument();
    expect(screen.getByTestId('toolkit-status-hubspot_crm')).toHaveTextContent('No Auth Needed');
  });
});
