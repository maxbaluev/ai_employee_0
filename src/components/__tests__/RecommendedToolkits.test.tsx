/// <reference types="vitest" />

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RecommendedToolkits } from '../RecommendedToolkits';

const sendTelemetryEventMock = vi.hoisted(() => vi.fn());

const originalFetch = globalThis.fetch;
const originalOpen = globalThis.open;

vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: sendTelemetryEventMock,
}));

describe('RecommendedToolkits', () => {
  const tenantId = '6b81fd7e-4c54-439c-a9ab-8c958c1abf8a';
  const missionId = 'd28c1e4e-1a18-4c4c-93ef-9f7e0d9363a6';

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    sendTelemetryEventMock.mockReset();
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
      json: async () => ({ success: true }),
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

  it('initiates OAuth connect flow for toolkits requiring auth', async () => {
    const alertSpy = vi.fn();

    mockToolkitLoad();

    const authorizationUrl = 'https://connect.composio.dev/oauth';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authorizationUrl, state: 'state', expiresAt: new Date().toISOString() }),
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

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const [, connectCall] = fetchMock.mock.calls;
    expect(connectCall?.[0]).toBe('/api/composio/connect');
    const connectPayload = JSON.parse(connectCall?.[1]?.body as string);
    expect(connectPayload).toMatchObject({
      mode: 'init',
      tenantId,
      missionId,
      provider: 'composio',
    });
    expect(connectPayload.redirectUri).toContain('/api/composio/connect');

    expect(openSpy).toHaveBeenCalledWith(authorizationUrl, '_blank', 'noopener');
    expect(sendTelemetryEventMock).toHaveBeenCalledWith(tenantId, {
      eventName: 'oauth_initiated',
      missionId,
      eventData: expect.objectContaining({
        provider: 'composio',
        toolkit_slug: 'clearbit',
      }),
    });

    expect(alertSpy).toHaveBeenCalledWith({
      tone: 'info',
      message: expect.stringContaining('Launching Clearbit Connect Link'),
    });
  });
});
