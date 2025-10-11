/// <reference types="vitest" />

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MissionIntake } from '../MissionIntake';

vi.mock('@copilotkit/react-core', () => ({
  useCopilotReadable: vi.fn(),
  useCopilotAction: vi.fn(),
}));

describe('MissionIntake fallback removal gate', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as Response,
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function renderIntake() {
    return render(
      <MissionIntake tenantId="tenant-1" objectiveId={null} onAccept={vi.fn()} />,
    );
  }

  it('does not surface skip/manual UI and hides fallback badges', async () => {
    const fallbackResponse = {
      missionId: 'mission-fallback',
      chips: {
        objective: 'Fallback mission objective',
        audience: 'Fallback audience',
        kpis: [],
        safeguardHints: [],
        confidence: 0.42,
        source: 'fallback',
      },
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => fallbackResponse,
    } as Response);

    const user = userEvent.setup();
    renderIntake();

    const textarea = screen.getByLabelText(/Mission input/i);
    await user.type(textarea, 'Fallback test input');

    await user.click(screen.getByRole('button', { name: /Generate mission/i }));

    await waitFor(() => {
      expect(screen.getByText('Fallback mission objective')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /manual/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Source: fallback/i)).not.toBeInTheDocument();
  });

  it('does not allow accepting a mission before chips are generated', () => {
    renderIntake();

    expect(
      screen.queryByRole('button', { name: /Accept mission intake/i }),
    ).not.toBeInTheDocument();
  });
});

