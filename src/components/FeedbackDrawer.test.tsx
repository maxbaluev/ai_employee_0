/// <reference types="vitest" />

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { FeedbackDrawer } from '@/components/FeedbackDrawer';
import { MissionStage } from '@/components/mission-stages';
import type { TelemetryEventPayload } from '@/lib/telemetry/client';

const telemetryMock = vi.hoisted(() =>
  vi.fn<[string, TelemetryEventPayload], Promise<void>>(() => Promise.resolve()),
);

vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: telemetryMock,
}));

const TENANT_ID = 'tenant-123';
const MISSION_ID = 'mission-abc';

type HarnessProps = {
  stage?: MissionStage;
  onSubmit?: (payload: { rating: number | null; comment: string }) => Promise<unknown> | unknown;
};

function Harness({ stage = MissionStage.Evidence, onSubmit }: HarnessProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  return (
    <>
      <FeedbackDrawer
        tenantId={TENANT_ID}
        missionId={MISSION_ID}
        currentStage={stage}
        isOpen={isOpen}
        selectedRating={rating}
        onOpenChange={setIsOpen}
        onRatingChange={setRating}
        onSubmit={onSubmit ?? (() => undefined)}
      />
      <button type="button" aria-label="Outside action">
        Outside action
      </button>
    </>
  );
}

describe('FeedbackDrawer', () => {
  beforeEach(() => {
    telemetryMock.mockClear();
  });

  it('only renders the drawer trigger once the mission reaches the Evidence stage', () => {
    const { rerender } = render(<Harness stage={MissionStage.Plan} />);

    expect(screen.queryByRole('button', { name: /open feedback drawer/i })).not.toBeInTheDocument();

    rerender(<Harness stage={MissionStage.Evidence} />);

    expect(screen.getByRole('button', { name: /open feedback drawer/i })).toBeInTheDocument();
  });

  it('supports keyboard activation and escape closing while returning focus to the trigger', async () => {
    render(<Harness />);
    const user = userEvent.setup();

    const trigger = await screen.findByRole('button', { name: /open feedback drawer/i });

    trigger.focus();
    await user.keyboard('{Enter}');

    const drawer = await screen.findByRole('dialog', { name: /mission feedback/i });
    expect(drawer).toBeVisible();

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /mission feedback/i })).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();

    trigger.focus();
    await user.keyboard('{Space}');

    await screen.findByRole('dialog', { name: /mission feedback/i });
  });

  it('traps focus inside the drawer while it is open', async () => {
    render(<Harness />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /open feedback drawer/i }));

    const drawer = await screen.findByRole('dialog', { name: /mission feedback/i });
    const outsideButton = screen.getByRole('button', { name: /outside action/i });
    const closeButton = within(drawer).getByRole('button', { name: /cancel/i });

    await waitFor(() => expect(closeButton).toHaveFocus());

    await user.tab();
    expect(outsideButton).not.toHaveFocus();

    await user.tab();
    expect(outsideButton).not.toHaveFocus();

    await user.tab({ shift: true });
    expect(outsideButton).not.toHaveFocus();
  });

  it('emits telemetry when a rating is selected', async () => {
    render(<Harness />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /open feedback drawer/i }));

    await user.click(
      within(await screen.findByRole('radiogroup', { name: /mission feedback/i })).getByRole('radio', {
        name: '4',
      }),
    );

    await waitFor(() => expect(telemetryMock).toHaveBeenCalled());

    const ratingCall = telemetryMock.mock.calls.find(
      ([, payload]) => payload.eventName === 'feedback_rating_selected',
    );

    expect(ratingCall).toBeDefined();
    expect(ratingCall?.[0]).toBe(TENANT_ID);
    expect(ratingCall?.[1]).toMatchObject({
      missionId: MISSION_ID,
      eventData: expect.objectContaining({ rating: 4, stage: MissionStage.Evidence }),
    });
  });

  it('submits written feedback, emits telemetry, and resets the form', async () => {
    const submitMock = vi.fn();
    render(<Harness onSubmit={submitMock} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /open feedback drawer/i }));

    const drawer = await screen.findByRole('dialog', { name: /mission feedback/i });
    await user.click(within(drawer).getByRole('radio', { name: '5' }));

    const commentField = within(drawer).getByLabelText(/additional context/i);
    await user.type(commentField, 'The mission artifacts were clear and motivating.');

    await user.click(within(drawer).getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => expect(submitMock).toHaveBeenCalledWith({
      rating: 5,
      comment: 'The mission artifacts were clear and motivating.',
    }));

    const commentCall = telemetryMock.mock.calls.find(
      ([, payload]) => payload.eventName === 'feedback_comment_submitted',
    );

    expect(commentCall).toBeDefined();
    expect(commentCall?.[1]).toMatchObject({
      missionId: MISSION_ID,
      eventData: expect.objectContaining({
        rating: 5,
        comment: 'The mission artifacts were clear and motivating.',
        stage: MissionStage.Evidence,
      }),
    });

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /mission feedback/i })).not.toBeInTheDocument(),
    );

    // Trigger should regain focus
    expect(screen.getByRole('button', { name: /open feedback drawer/i })).toHaveFocus();
  });
});

