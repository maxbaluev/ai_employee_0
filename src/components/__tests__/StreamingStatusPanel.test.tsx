/// <reference types="vitest" />

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StreamingStatusPanel } from '../StreamingStatusPanel';

describe('StreamingStatusPanel', () => {
  const tenantId = '3c33212c-d119-4ef1-8db0-2ca93cd3b2dd';
  const sessionIdentifier = 'mission-1234';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders streaming events and notifies reviewer requests', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const firstPayload = {
      messages: [
        {
          id: 'event-1',
          createdAt: '2025-10-09T15:00:00.000Z',
          stage: 'planner_rank_complete',
          role: 'assistant',
          metadata: { candidate_count: 3 },
          content: 'Planner ranked plays',
        },
      ],
      count: 1,
      nextCursor: '2025-10-09T15:00:00.000Z',
      fetchedAt: '2025-10-09T15:00:01.000Z',
    };

    const secondPayload = {
      messages: [
        {
          id: 'event-2',
          createdAt: '2025-10-09T15:00:04.000Z',
          stage: 'validator_reviewer_requested',
          role: 'assistant',
          metadata: { attempt: 2, tool_call_id: 'a1111111-b222-4ccc-8888-eeeeeeee0000' },
          content: 'Validator requested reviewer',
        },
      ],
      count: 1,
      nextCursor: '2025-10-09T15:00:04.000Z',
      fetchedAt: '2025-10-09T15:00:05.000Z',
    };

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(firstPayload), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(secondPayload), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );

    const reviewerRequested = vi.fn();
    const user = userEvent.setup();

    render(
      <StreamingStatusPanel
        tenantId={tenantId}
        agentId="control_plane_foundation"
        sessionIdentifier={sessionIdentifier}
        pollIntervalMs={2000}
        onReviewerRequested={reviewerRequested}
      />,
    );

    expect(await screen.findByText(/Planner ranked plays/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Reviewer attention required/i)).toBeInTheDocument();
    await waitFor(() => expect(reviewerRequested).toHaveBeenCalledTimes(1));

    expect(
      await screen.findByText(/Validator requested input. Open the approval modal/i),
    ).toBeInTheDocument();

    const reviewerButton = screen.getByRole('button', { name: /Open approval modal/i });
    expect(reviewerButton).toBeEnabled();

    await user.click(reviewerButton);
    expect(reviewerRequested).toHaveBeenCalledTimes(2);
  }, 10000);

  it('disables controls and surfaces exit summary after copilotkit_exit event', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const initialPayload = {
      messages: [
        {
          id: 'event-1',
          createdAt: '2025-10-09T18:00:00.000Z',
          stage: 'planner_rank_complete',
          role: 'assistant',
          metadata: { candidate_count: 2 },
          content: 'Planner done',
        },
      ],
      count: 1,
      nextCursor: '2025-10-09T18:00:00.000Z',
      fetchedAt: '2025-10-09T18:00:01.000Z',
    };

    const exitPayload = {
      messages: [
        {
          id: 'event-2',
          createdAt: '2025-10-09T18:00:05.000Z',
          stage: null,
          role: 'system',
          metadata: {
            event: 'copilotkit_exit',
            stage: 'execution_loop_completed',
            mission_status: 'completed',
            reason: 'completed',
          },
          content: 'Session exited: completed',
        },
      ],
      count: 1,
      nextCursor: '2025-10-09T18:00:05.000Z',
      fetchedAt: '2025-10-09T18:00:05.500Z',
    };

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(initialPayload), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(exitPayload), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );

    const user = userEvent.setup();

    render(
      <StreamingStatusPanel
        tenantId={tenantId}
        agentId="control_plane_foundation"
        sessionIdentifier={sessionIdentifier}
        pollIntervalMs={2000}
      />,
    );

    expect(await screen.findByText(/Planner ranked plays/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(await screen.findByText(/Dry-run loop completed and timeline is archived/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pause/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeDisabled();
  });
});
