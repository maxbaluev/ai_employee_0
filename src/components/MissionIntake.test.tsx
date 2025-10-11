/// <reference types="vitest" />

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@copilotkit/react-core', () => ({
  useCopilotReadable: vi.fn(),
  useCopilotAction: vi.fn(),
}));

import { MissionIntake } from './MissionIntake';

describe('MissionIntake', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('shows the fallback source badge when source is fallback', async () => {
    const mockGenerateResponse = {
      missionId: 'mission-123',
      chips: {
        objective: 'Launch new product',
        audience: 'Enterprise customers',
        kpis: [
          { label: 'Completion rate', target: '100%' },
        ],
        safeguardHints: [
          {
            id: 'sg-1',
            hintType: 'tone',
            text: 'Maintain professional tone',
            confidence: 0.8,
            status: 'suggested',
          },
        ],
        confidence: 0.75,
        source: 'fallback',
      },
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => mockGenerateResponse,
    } as Response);

    const onAccept = vi.fn();
    const user = userEvent.setup();

    render(
      <MissionIntake
        tenantId="tenant-1"
        objectiveId={null}
        onAccept={onAccept}
      />
    );

    const textarea = screen.getByLabelText(/Mission input/i);
    await user.type(textarea, 'Test mission context');

    const generateButton = screen.getByRole('button', { name: /Generate mission/i });
    await user.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('Launch new product')).toBeInTheDocument();
    });

    expect(screen.getByText(/Source:/i)).toHaveTextContent(/fallback/i);
  });

  it('renders generated chips for objective, audience, KPIs, and safeguards', async () => {
    const mockGenerateResponse = {
      missionId: 'mission-456',
      chips: {
        objective: 'Improve customer satisfaction',
        audience: 'Support team',
        kpis: [
          { label: 'CSAT score', target: '90%' },
        ],
        safeguardHints: [
          {
            id: 'sg-2',
            hintType: 'escalation',
            text: 'Escalate critical issues',
            confidence: 0.85,
            status: 'suggested',
          },
        ],
        confidence: 0.88,
        source: 'gemini',
      },
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => mockGenerateResponse,
    } as Response);

    const onAccept = vi.fn();
    const user = userEvent.setup();

    render(
      <MissionIntake
        tenantId="tenant-2"
        objectiveId={null}
        onAccept={onAccept}
      />
    );

    const textarea = screen.getByLabelText(/Mission input/i);
    await user.type(textarea, 'Improve customer experience');

    const generateButton = screen.getByRole('button', { name: /Generate mission/i });
    await user.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('Improve customer satisfaction')).toBeInTheDocument();
    });

    expect(screen.getByText('Improve customer satisfaction')).toBeInTheDocument();
    expect(screen.getByText('Support team')).toBeInTheDocument();
    expect(screen.getByText(/CSAT score/i)).toBeInTheDocument();
    expect(screen.getByText('Escalate critical issues')).toBeInTheDocument();
  });

  it('allows editing the generated objective text and persists the change', async () => {
    const mockGenerateResponse = {
      missionId: 'mission-789',
      chips: {
        objective: 'Expand market reach',
        audience: 'Marketing team',
        kpis: [
          { label: 'Lead generation', target: '500 leads' },
        ],
        safeguardHints: [
          {
            id: 'sg-3',
            hintType: 'budget',
            text: 'Monitor budget limits',
            confidence: 0.72,
            status: 'suggested',
          },
        ],
        confidence: 0.8,
        source: 'gemini',
      },
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => mockGenerateResponse,
    } as Response);

    const onAccept = vi.fn();
    const user = userEvent.setup();

    render(
      <MissionIntake
        tenantId="tenant-3"
        objectiveId={null}
        onAccept={onAccept}
      />
    );

    const textarea = screen.getByLabelText(/Mission input/i);
    await user.type(textarea, 'Expand our business');

    const generateButton = screen.getByRole('button', { name: /Generate mission/i });
    await user.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('Expand market reach')).toBeInTheDocument();
    });

    const editButton = screen.getAllByRole('button', { name: /Edit/i })[0];
    await user.click(editButton);

    const editInput = screen.getByDisplayValue('Expand market reach');
    await user.clear(editInput);
    await user.type(editInput, 'Modified objective text');

    const saveButton = screen.getByRole('button', { name: /Save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Modified objective text')).toBeInTheDocument();
    });
  });
});
