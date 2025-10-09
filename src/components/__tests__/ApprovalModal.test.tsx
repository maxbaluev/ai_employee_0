/// <reference types="vitest" />

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ApprovalSubmission, SubmitResult } from '@/hooks/useApprovalFlow';

import { ApprovalModal } from '../ApprovalModal';

describe('ApprovalModal', () => {
  it('traps focus and submits via keyboard shortcut', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn<[ApprovalSubmission], Promise<SubmitResult>>(() =>
      Promise.resolve({ ok: true, approvalId: 'approval-1' }),
    );

    const user = userEvent.setup();

    render(
      <ApprovalModal
        isOpen
        isSubmitting={false}
        error={null}
        onClose={onClose}
        onSubmit={onSubmit}
        request={{
          toolCallId: '11111111-2222-3333-4444-555555555555',
          stage: 'validator_reviewer_requested',
          attempt: 2,
          metadata: { attempt: 2 },
        }}
      />,
    );

    const closeButton = screen.getByRole('button', { name: /Close/i });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));

    await user.tab();
    const approveButton = screen.getByRole('button', { name: /Approve dry-run/i });
    await waitFor(() => expect(document.activeElement).toBe(approveButton));

    await user.tab();
    const needsRevision = screen.getByRole('button', { name: /Needs revision/i });
    await waitFor(() => expect(document.activeElement).toBe(needsRevision));

    await user.tab({ shift: true });
    await waitFor(() => expect(document.activeElement).toBe(approveButton));

    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submission = onSubmit.mock.calls[0][0];
    expect(submission.decision).toBe('approved');
  });

  it('passes guardrail violation data when toggled', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn<[ApprovalSubmission], Promise<SubmitResult>>(() =>
      Promise.resolve({ ok: true, approvalId: null }),
    );
    const user = userEvent.setup();

    render(
      <ApprovalModal
        isOpen
        isSubmitting={false}
        error={null}
        onClose={onClose}
        onSubmit={onSubmit}
        request={{
          toolCallId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          stage: 'validator_reviewer_requested',
          metadata: {},
        }}
      />,
    );

    await user.click(screen.getByLabelText(/Log guardrail violation/i));
    await user.type(screen.getByPlaceholderText(/note what failed/i), 'Violation: tone drift');

    await user.click(screen.getByRole('button', { name: /Submit decision/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submission = onSubmit.mock.calls[0][0];
    expect(submission.guardrailViolation).toEqual({ violated: true, notes: 'Violation: tone drift' });
  });
});
