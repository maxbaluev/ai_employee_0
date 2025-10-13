/// <reference types="vitest" />

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MissionIntake } from '../MissionIntake';

vi.mock('@copilotkit/react-core', () => ({
  useCopilotReadable: vi.fn(),
  useCopilotAction: vi.fn(),
}));

describe('MissionIntake Gemini-only behavior', () => {
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

  it('displays confidence badge and generated chips', async () => {
    const geminiResponse = {
      missionId: 'mission-gemini',
      chips: {
        objective: 'Gemini mission objective',
        audience: 'Gemini audience',
        kpis: [{ label: 'Test KPI', target: '100%' }],
        safeguardHints: [
          {
            id: 'sg-1',
            hintType: 'tone',
            text: 'Maintain professional tone',
            confidence: 0.8,
            status: 'suggested',
          },
        ],
        confidence: 0.92,
      },
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => geminiResponse,
    } as Response);

    const user = userEvent.setup();
    renderIntake();

    const textarea = screen.getByLabelText(/Mission input/i);
    await user.type(textarea, 'Test Gemini input');

    await user.click(screen.getByRole('button', { name: /Generate mission/i }));

    await waitFor(() => {
      expect(screen.getByText('Gemini mission objective')).toBeInTheDocument();
    });

    expect(screen.getByText('Gemini audience')).toBeInTheDocument();
    expect(screen.getByText(/Test KPI/i)).toBeInTheDocument();
    // Confidence badges now appear for all fields (objective, audience, KPIs, safeguards)
    expect(screen.getAllByText(/High confidence/i).length).toBeGreaterThanOrEqual(4);
  });

  it('shows error message when generation fails', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to generate intake with Gemini' }),
    } as Response);

    const user = userEvent.setup();
    renderIntake();

    const textarea = screen.getByLabelText(/Mission input/i);
    await user.type(textarea, 'Test input');

    await user.click(screen.getByRole('button', { name: /Generate mission/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to generate intake with Gemini/i)).toBeInTheDocument();
    });
  });

  it('does not allow accepting a mission before chips are generated', () => {
    renderIntake();

    expect(
      screen.queryByRole('button', { name: /Accept mission intake/i }),
    ).not.toBeInTheDocument();
  });
});

