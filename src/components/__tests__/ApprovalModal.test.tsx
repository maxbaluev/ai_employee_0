/// <reference types="vitest" />

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { webcrypto } from 'node:crypto';

import type { ApprovalSubmission, SubmitResult } from '@/hooks/useApprovalFlow';

import { ApprovalModal } from '../ApprovalModal';

const approvalFlowTelemetryMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useApprovalFlow', () => ({
  useApprovalFlow: () => ({
    isOpen: true,
    isSubmitting: false,
    error: null,
    latestDecision: null,
    currentRequest: null,
    openApproval: vi.fn(),
    closeApproval: vi.fn(),
    submitApproval: vi.fn(),
    clearError: vi.fn(),
    emitTelemetry: approvalFlowTelemetryMock,
  }),
}));

let fetchMock: vi.Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  const cryptoSource = (globalThis.crypto ??= webcrypto);
  vi.spyOn(cryptoSource as { randomUUID: () => string }, 'randomUUID').mockReturnValue('validator-test-uuid');
  approvalFlowTelemetryMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
        emitTelemetry={approvalFlowTelemetryMock}
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
        emitTelemetry={approvalFlowTelemetryMock}
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

  it('surfaces validator quick-fix actions and records telemetry for Apply fix/Edit/Send anyway', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn<[ApprovalSubmission], Promise<SubmitResult>>(() =>
      Promise.resolve({ ok: true, approvalId: null }),
    );
    const user = userEvent.setup();

    const quickFix = {
      summary: 'Tone softening available',
      suggestion: 'Ask agent to rewrite reply with warm-professional tone',
    };

    render(
      <ApprovalModal
        isOpen
        isSubmitting={false}
        error={null}
        onClose={onClose}
        onSubmit={onSubmit}
        emitTelemetry={approvalFlowTelemetryMock}
        request={{
          toolCallId: 'quickfix-tool-call',
          stage: 'validator_reviewer_requested',
          metadata: {
            quickFix,
            validatorSummary: 'Validator recommends tone softening before approval',
          },
        }}
        safeguardChips={[
          { type: 'tone', value: 'Maintain warm-professional tone' },
        ]}
      />,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(approvalFlowTelemetryMock).not.toHaveBeenCalled();

    expect(
      await screen.findByText('Validator recommends tone softening before approval'),
    ).toBeInTheDocument();

    const applyFixButton = await screen.findByRole('button', { name: /Apply fix/i });
    const editManuallyButton = screen.getByRole('button', { name: /Edit manually/i });
    const sendAnywayButton = screen.getByRole('button', { name: /Send anyway/i });

    await user.click(applyFixButton);
    await user.click(editManuallyButton);
    await user.click(sendAnywayButton);

    expect(approvalFlowTelemetryMock).toHaveBeenCalledTimes(3);
    expect(approvalFlowTelemetryMock).toHaveBeenCalledWith(
      'validator_quick_fix_applied',
      expect.objectContaining({
        tool_call_id: 'quickfix-tool-call',
        quick_fix_summary: quickFix.summary,
        quick_fix_suggestion: quickFix.suggestion,
      }),
    );
    expect(approvalFlowTelemetryMock).toHaveBeenCalledWith(
      'validator_quick_fix_edit',
      expect.objectContaining({
        tool_call_id: 'quickfix-tool-call',
        quick_fix_summary: quickFix.summary,
      }),
    );
    expect(approvalFlowTelemetryMock).toHaveBeenCalledWith(
      'validator_quick_fix_send_anyway',
      expect.objectContaining({
        tool_call_id: 'quickfix-tool-call',
        quick_fix_summary: quickFix.summary,
        decision: 'approved',
      }),
    );
  });

  it('supports inline safeguard edit path inside modal', async () => {
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
        emitTelemetry={approvalFlowTelemetryMock}
        request={{
          toolCallId: 'inline-edit-tool-call',
          stage: 'validator_reviewer_requested',
          metadata: {
            quickFix: null,
            enableInlineEdit: true,
          },
        }}
        safeguardChips={[
          { type: 'tone', value: 'Maintain professional tone', status: 'accepted' },
        ]}
      />,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(approvalFlowTelemetryMock).not.toHaveBeenCalled();

    const editButton = await screen.findByRole('button', { name: /Edit safeguard inline/i });
    await user.click(editButton);

    const editor = await screen.findByRole('textbox', { name: /Edit safeguard/i });
    await user.clear(editor);
    await user.type(editor, 'Use warm tone with gratitude sign-off');
    await user.click(screen.getByRole('button', { name: /Save safeguard edit/i }));

    expect(approvalFlowTelemetryMock).toHaveBeenCalledTimes(1);
    expect(approvalFlowTelemetryMock).toHaveBeenCalledWith(
      'modal_safeguard_edit_saved',
      expect.objectContaining({
        tool_call_id: 'inline-edit-tool-call',
        safeguard_label: 'Use warm tone with gratitude sign-off',
      }),
    );
  });

  it('renders conflict guidance and emits telemetry when reviewer keeps decision', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn<[ApprovalSubmission], Promise<SubmitResult>>(() =>
      Promise.resolve({ ok: false, error: 'Approval already recorded by reviewer 2' }),
    );
    const user = userEvent.setup();

    render(
      <ApprovalModal
        isOpen
        isSubmitting={false}
        error={null}
        onClose={onClose}
        onSubmit={onSubmit}
        emitTelemetry={approvalFlowTelemetryMock}
        request={{
          toolCallId: 'conflict-test-tool-call',
          stage: 'validator_reviewer_requested',
          metadata: {
            conflict: {
              reviewer: 'Taylor (EU shift)',
              decision: 'needs_changes',
              timestamp: '2025-10-09T14:12:00Z',
            },
          },
        }}
        latestDecision="needs_changes"
      />,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(approvalFlowTelemetryMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Submit decision/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Another reviewer marked this as needs_changes/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Taylor \(EU shift\)/i)).toBeInTheDocument();
      expect(screen.getByText(/2025-10-09T14:12:00Z/i)).toBeInTheDocument();
    });

    expect(approvalFlowTelemetryMock).toHaveBeenCalledTimes(1);
    expect(approvalFlowTelemetryMock).toHaveBeenCalledWith(
      'approval_conflict_detected',
      expect.objectContaining({
        tool_call_id: 'conflict-test-tool-call',
        conflicting_reviewer: 'Taylor (EU shift)',
        conflicting_decision: 'needs_changes',
        conflicting_timestamp: '2025-10-09T14:12:00Z',
      }),
    );
  });
});
