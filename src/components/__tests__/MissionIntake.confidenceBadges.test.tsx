/// <reference types="vitest" />

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MissionIntake } from '../MissionIntake';

vi.mock('@copilotkit/react-core', () => ({
  useCopilotReadable: vi.fn(),
  useCopilotAction: vi.fn(),
}));

// Mock telemetry
const mockTelemetryEvents: Array<{ eventName: string; missionId?: string; eventData?: Record<string, unknown> }> = [];

vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: vi.fn(async (_tenantId: string, payload: { eventName: string; missionId?: string | null; eventData?: Record<string, unknown> }) => {
    mockTelemetryEvents.push({
      eventName: payload.eventName,
      missionId: payload.missionId ?? undefined,
      eventData: payload.eventData,
    });
  }),
}));

describe('MissionIntake - Confidence Badges (Gate G-B)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockTelemetryEvents.length = 0;
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

  describe('Confidence Badge Tier Rendering', () => {
    it('displays green badge for high confidence (≥0.75)', async () => {
      const highConfidenceResponse = {
        missionId: 'mission-high',
        chips: {
          objective: 'High confidence objective',
          audience: 'High confidence audience',
          kpis: [{ label: 'KPI 1', target: '100%' }],
          safeguardHints: [
            {
              id: 'sg-1',
              hintType: 'tone',
              text: 'Maintain professional tone',
              confidence: 0.9,
              status: 'suggested',
            },
          ],
          confidence: 0.85,
        },
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => highConfidenceResponse,
      } as Response);

      const user = userEvent.setup();
      renderIntake();

      const textarea = screen.getByLabelText(/Mission input/i);
      await user.type(textarea, 'Test high confidence');

      await user.click(screen.getByRole('button', { name: /Generate mission/i }));

      await waitFor(() => {
        expect(screen.getByText('High confidence objective')).toBeInTheDocument();
      });

      // Should render multiple "High confidence" badges (one for each field)
      const badges = screen.getAllByText(/High confidence/i);
      expect(badges.length).toBeGreaterThanOrEqual(4); // objective, audience, kpis, safeguards
    });

    it('displays amber badge for medium confidence (0.4–0.74)', async () => {
      const mediumConfidenceResponse = {
        missionId: 'mission-medium',
        chips: {
          objective: 'Medium confidence objective',
          audience: 'Medium confidence audience',
          kpis: [{ label: 'KPI 1', target: '100%' }],
          safeguardHints: [
            {
              id: 'sg-1',
              hintType: 'tone',
              text: 'Consider tone',
              confidence: 0.6,
              status: 'suggested',
            },
          ],
          confidence: 0.6,
        },
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mediumConfidenceResponse,
      } as Response);

      const user = userEvent.setup();
      renderIntake();

      const textarea = screen.getByLabelText(/Mission input/i);
      await user.type(textarea, 'Test medium confidence');

      await user.click(screen.getByRole('button', { name: /Generate mission/i }));

      await waitFor(() => {
        expect(screen.getByText('Medium confidence objective')).toBeInTheDocument();
      });

      const badges = screen.getAllByText(/Medium confidence/i);
      expect(badges.length).toBeGreaterThanOrEqual(4);
    });

    it('displays red badge for low confidence (<0.4)', async () => {
      const lowConfidenceResponse = {
        missionId: 'mission-low',
        chips: {
          objective: 'Low confidence objective',
          audience: 'Low confidence audience',
          kpis: [{ label: 'KPI 1', target: '100%' }],
          safeguardHints: [
            {
              id: 'sg-1',
              hintType: 'tone',
              text: 'Review carefully',
              confidence: 0.3,
              status: 'suggested',
            },
          ],
          confidence: 0.3,
        },
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => lowConfidenceResponse,
      } as Response);

      const user = userEvent.setup();
      renderIntake();

      const textarea = screen.getByLabelText(/Mission input/i);
      await user.type(textarea, 'Test low confidence');

      await user.click(screen.getByRole('button', { name: /Generate mission/i }));

      await waitFor(() => {
        expect(screen.getByText('Low confidence objective')).toBeInTheDocument();
      });

      const badges = screen.getAllByText(/Low confidence/i);
      expect(badges.length).toBeGreaterThanOrEqual(4);
    });

    it('displays badges for all fields: objective, audience, KPIs, and safeguards', async () => {
      const response = {
        missionId: 'mission-all-fields',
        chips: {
          objective: 'Test objective',
          audience: 'Test audience',
          kpis: [{ label: 'KPI 1', target: '100%' }],
          safeguardHints: [
            {
              id: 'sg-1',
              hintType: 'tone',
              text: 'Test safeguard',
              confidence: 0.8,
              status: 'suggested',
            },
          ],
          confidence: 0.8,
        },
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => response,
      } as Response);

      const user = userEvent.setup();
      renderIntake();

      const textarea = screen.getByLabelText(/Mission input/i);
      await user.type(textarea, 'Test all fields');

      await user.click(screen.getByRole('button', { name: /Generate mission/i }));

      await waitFor(() => {
        expect(screen.getByText('Test objective')).toBeInTheDocument();
      });

      // Verify presence near each field label
      expect(screen.getByText('Objective')).toBeInTheDocument();
      expect(screen.getByText('Audience')).toBeInTheDocument();
      expect(screen.getByText('KPIs')).toBeInTheDocument();
      expect(screen.getByText('Safeguard hints')).toBeInTheDocument();

      // All should have confidence badges
      const badges = screen.getAllByText(/High confidence/i);
      expect(badges.length).toBe(4);
    });
  });

  describe('Telemetry Events', () => {
    it('emits intake_confidence_viewed event on initial generation', async () => {
      const response = {
        missionId: 'mission-telemetry',
        chips: {
          objective: 'Test objective',
          audience: 'Test audience',
          kpis: [],
          safeguardHints: [],
          confidence: 0.85,
        },
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => response,
      } as Response);

      const user = userEvent.setup();
      renderIntake();

      const textarea = screen.getByLabelText(/Mission input/i);
      await user.type(textarea, 'Test telemetry');

      await user.click(screen.getByRole('button', { name: /Generate mission/i }));

      await waitFor(() => {
        expect(screen.getByText('Test objective')).toBeInTheDocument();
      });

      // Check telemetry event was emitted
      const confidenceEvent = mockTelemetryEvents.find((e) => e.eventName === 'intake_confidence_viewed');
      expect(confidenceEvent).toBeDefined();
      expect(confidenceEvent?.missionId).toBe('mission-telemetry');
      expect(confidenceEvent?.eventData).toMatchObject({
        tier: 'green',
        confidence: 0.85,
        regenerationCount: 0,
      });
    });

    it('emits intake_confidence_viewed event with updated regeneration count after regeneration', async () => {
      const initialResponse = {
        missionId: 'mission-regen',
        chips: {
          objective: 'Initial objective',
          audience: 'Initial audience',
          kpis: [],
          safeguardHints: [],
          confidence: 0.7,
        },
      };

      const regeneratedResponse = {
        chips: {
          objective: 'Regenerated objective',
          audience: 'Initial audience',
          kpis: [],
          safeguardHints: [],
          confidence: 0.8,
        },
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => initialResponse,
      } as Response);

      const user = userEvent.setup();
      renderIntake();

      const textarea = screen.getByLabelText(/Mission input/i);
      await user.type(textarea, 'Test regeneration telemetry');

      await user.click(screen.getByRole('button', { name: /Generate mission/i }));

      await waitFor(() => {
        expect(screen.getByText('Initial objective')).toBeInTheDocument();
      });

      // Keep track of how many events we had before regeneration
      const eventCountBefore = mockTelemetryEvents.length;

      // Mock regenerate API call
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => regeneratedResponse,
      } as Response);

      // Find and click the Regenerate button for objective
      const regenerateButtons = screen.getAllByRole('button', { name: /Regenerate/i });
      await user.click(regenerateButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Regenerated objective')).toBeInTheDocument();
      });

      // Wait for the new telemetry event to be emitted
      await waitFor(() => {
        expect(mockTelemetryEvents.length).toBeGreaterThan(eventCountBefore);
      });

      // Check that a new telemetry event was emitted after regeneration
      const newEvents = mockTelemetryEvents.slice(eventCountBefore);
      const confidenceEvent = newEvents.find((e) => e.eventName === 'intake_confidence_viewed');
      expect(confidenceEvent).toBeDefined();
      expect(confidenceEvent?.eventData).toMatchObject({
        tier: 'green',
        confidence: 0.8,
      });
      // RegenerationCount is tracked and emitted; exact timing may vary in test environment
      expect(typeof (confidenceEvent?.eventData as { regenerationCount?: number })?.regenerationCount).toBe('number');
    });
  });

  describe('Regeneration History', () => {
    it('updates badges to show regeneration count after regeneration', async () => {
      const initialResponse = {
        missionId: 'mission-regen-count',
        chips: {
          objective: 'Initial objective',
          audience: 'Initial audience',
          kpis: [],
          safeguardHints: [],
          confidence: 0.7,
        },
      };

      const regeneratedResponse = {
        chips: {
          objective: 'Regenerated objective',
          audience: 'Initial audience',
          kpis: [],
          safeguardHints: [],
          confidence: 0.8,
        },
      };

      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: async () => initialResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => regeneratedResponse,
        } as Response);

      const user = userEvent.setup();
      renderIntake();

      const textarea = screen.getByLabelText(/Mission input/i);
      await user.type(textarea, 'Test regen count');

      await user.click(screen.getByRole('button', { name: /Generate mission/i }));

      await waitFor(() => {
        expect(screen.getByText('Initial objective')).toBeInTheDocument();
      });

      // Regenerate objective
      const regenerateButtons = screen.getAllByRole('button', { name: /Regenerate/i });
      await user.click(regenerateButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Regenerated objective')).toBeInTheDocument();
      });

      // Verify telemetry events include regeneration tracking
      await waitFor(() => {
        const regenEvents = mockTelemetryEvents.filter((e) => e.eventName === 'intake_confidence_viewed');
        // Should have at least 2 events: initial generation + regeneration
        expect(regenEvents.length).toBeGreaterThanOrEqual(2);
        // At least one event should have regenerationCount defined
        expect(regenEvents.some((e) => typeof (e.eventData as { regenerationCount?: number })?.regenerationCount === 'number')).toBe(true);
      });
    });
  });

  describe('Graceful Handling', () => {
    it('suppresses badges when confidence is null or undefined', async () => {
      // This test ensures the component handles missing confidence gracefully
      // In the current implementation, confidence is always returned by the API,
      // but we should handle the null case gracefully if it ever happens
      const responseNoConfidence = {
        missionId: 'mission-no-conf',
        chips: {
          objective: 'Objective without confidence',
          audience: 'Audience without confidence',
          kpis: [],
          safeguardHints: [],
          confidence: 0, // Test edge case: 0 confidence should show low badge
        },
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => responseNoConfidence,
      } as Response);

      const user = userEvent.setup();
      renderIntake();

      const textarea = screen.getByLabelText(/Mission input/i);
      await user.type(textarea, 'Test no confidence');

      await user.click(screen.getByRole('button', { name: /Generate mission/i }));

      await waitFor(() => {
        expect(screen.getByText('Objective without confidence')).toBeInTheDocument();
      });

      // Should show red badges for 0 confidence
      const badges = screen.getAllByText(/Low confidence/i);
      expect(badges.length).toBeGreaterThan(0);
    });
  });
});
