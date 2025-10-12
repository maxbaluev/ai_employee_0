/// <reference types="vitest" />

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { webcrypto } from 'node:crypto';

import { SafeguardDrawer, type SafeguardDrawerHint } from '@/components/SafeguardDrawer';

const approvalFlowTelemetryMock = vi.hoisted(() => vi.fn());
const approvalFlowOpenMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useApprovalFlow', () => ({
  useApprovalFlow: () => ({
    isOpen: false,
    isSubmitting: false,
    error: null,
    latestDecision: null,
    currentRequest: null,
    openApproval: approvalFlowOpenMock,
    closeApproval: vi.fn(),
    submitApproval: vi.fn(),
    clearError: vi.fn(),
    emitTelemetry: approvalFlowTelemetryMock,
  }),
}));

const baseHint: SafeguardDrawerHint = {
  id: 's-1',
  label: 'Keep tone warm-professional',
  hintType: 'tone',
  status: 'suggested',
  confidence: 0.82,
};

let fetchMock: vi.Mock;

beforeEach(() => {
  approvalFlowTelemetryMock.mockReset();
  approvalFlowOpenMock.mockReset();

  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  const cryptoSource = (globalThis.crypto ??= webcrypto);
  vi.spyOn(cryptoSource as { randomUUID: () => string }, 'randomUUID').mockReturnValue('test-uuid');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type SafeguardDrawerProps = ComponentProps<typeof SafeguardDrawer>;

function renderDrawer(props: Record<string, unknown> = {}) {
  const defaultProps = {
    safeguards: [baseHint],
    onAcceptAll: vi.fn(),
    onAccept: vi.fn(),
    onEdit: vi.fn(),
    onRegenerate: vi.fn(),
    onTogglePin: vi.fn(),
    onTelemetry: vi.fn(),
    onHistoryToggle: vi.fn(),
    onApplyFix: vi.fn(),
  } as unknown as SafeguardDrawerProps;

  const merged = { ...defaultProps, ...props } as Record<string, unknown>;
  return {
    onAcceptAll: merged.onAcceptAll as vi.Mock,
    onAccept: merged.onAccept as vi.Mock,
    onEdit: merged.onEdit as vi.Mock,
    onRegenerate: merged.onRegenerate as vi.Mock,
    onTogglePin: merged.onTogglePin as vi.Mock,
    onTelemetry: merged.onTelemetry as vi.Mock,
    onHistoryToggle: merged.onHistoryToggle as vi.Mock,
    onApplyFix: merged.onApplyFix as vi.Mock,
    utils: render(<SafeguardDrawer {...(merged as SafeguardDrawerProps)} />),
  };
}

describe('SafeguardDrawer', () => {
  it('renders safeguard list with actions', () => {
    renderDrawer();

    expect(screen.getByRole('heading', { name: /safeguards/i })).toBeInTheDocument();
    expect(screen.getByText(baseHint.label)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^accept$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('invokes onAcceptAll when Accept All is clicked and fires telemetry', async () => {
    const user = userEvent.setup();
    const { onAcceptAll, onTelemetry } = renderDrawer();

    await user.click(screen.getByRole('button', { name: /accept all/i }));

    expect(onAcceptAll).toHaveBeenCalledTimes(1);
    expect(onTelemetry).toHaveBeenCalledWith({ type: 'accept_all', safeguard: undefined });
  });

  it('invokes per-safeguard callbacks for accept, edit, regenerate, and pin', async () => {
    const user = userEvent.setup();
    const { onAccept, onEdit, onRegenerate, onTogglePin, onTelemetry } = renderDrawer();

    await user.click(screen.getByRole('button', { name: /^accept$/i }));
    await user.click(screen.getByRole('button', { name: /^regenerate$/i }));
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    await user.click(screen.getByRole('button', { name: /^pin$/i }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
    expect(onTogglePin).toHaveBeenCalledWith(baseHint, true);
    expect(onTelemetry).toHaveBeenCalledWith({ type: 'accept', safeguard: baseHint });
    expect(onTelemetry).toHaveBeenCalledWith({ type: 'regenerate', safeguard: baseHint });
    expect(onTelemetry).toHaveBeenCalledWith({ type: 'edit_start', safeguard: expect.objectContaining({ id: baseHint.id }) });
    expect(screen.getByRole('textbox', { name: /edit safeguard/i })).toHaveValue(baseHint.label);
    expect(onTelemetry).toHaveBeenCalledWith({ type: 'toggle_pin', safeguard: baseHint });
  });

  it('toggles pin button label when pressed', async () => {
    const user = userEvent.setup();
    const { utils } = renderDrawer();

    await user.click(screen.getByRole('button', { name: /^pin$/i }));

    utils.rerender(
      <SafeguardDrawer
        safeguards={[{ ...baseHint, pinned: true }]}
        onAcceptAll={vi.fn()}
        onAccept={vi.fn()}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
        onTogglePin={vi.fn()}
        onTelemetry={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /^unpin$/i })).toBeInTheDocument();
  });

  it('toggles history accordion aria-expanded and invokes telemetry', async () => {
    const user = userEvent.setup();
    const { onHistoryToggle, onTelemetry } = renderDrawer({
      historyItems: [{ id: 'h-1', label: 'Quiet hours enforced', status: 'accepted' }],
      onHistoryToggle: vi.fn(),
    });

    const toggle = screen.getByRole('button', { name: /safeguard history/i });

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(onHistoryToggle).toHaveBeenCalledWith(true);
    expect(onTelemetry).toHaveBeenCalledWith({ type: 'history_opened', safeguard: undefined });

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(onHistoryToggle).toHaveBeenCalledWith(false);
    expect(onTelemetry).toHaveBeenCalledWith({ type: 'history_closed', safeguard: undefined });
  });

  it('supports inline edit workflow with cancel without issuing network requests', async () => {
    const user = userEvent.setup();
    const { onEdit, onTelemetry } = renderDrawer();

    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    const editor = await screen.findByRole('textbox', { name: /edit safeguard/i });
    expect(editor).toHaveValue(baseHint.label);

    await user.clear(editor);
    await user.type(editor, 'Use calm tone with gratitude');

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: /edit safeguard/i })).not.toBeInTheDocument();

    expect(onTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'edit_start', safeguard: expect.objectContaining({ id: baseHint.id }) }),
    );
    expect(onTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'edit_cancel',
        draft: 'Use calm tone with gratitude',
        safeguard: expect.objectContaining({ id: baseHint.id }),
      }),
    );
  });

  it('saves inline edit changes and emits telemetry via approval flow', async () => {
    const user = userEvent.setup();
    const { onEdit, onTelemetry } = renderDrawer();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    const editor = await screen.findByRole('textbox', { name: /edit safeguard/i });
    await user.clear(editor);
    await user.type(editor, 'Use neutral, calm tone');

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: baseHint.id, label: 'Use neutral, calm tone', status: 'edited' }),
    );

    await waitFor(() => {
      expect(onTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'edit_save',
          safeguard: expect.objectContaining({ id: baseHint.id, label: 'Use neutral, calm tone' }),
        }),
      );
    });

    expect(approvalFlowTelemetryMock).toHaveBeenCalledWith('safeguard_edit_saved', { hint_id: baseHint.id });
  });

  it('applies quick fix from Apply Fix button and records telemetry', async () => {
    const user = userEvent.setup();
    const quickFix = {
      label: 'Adopt warm professional tone',
      value: 'Warm professional tone with gratitude sign-off',
    };
    const hintWithFix: SafeguardDrawerHint & { quickFix: typeof quickFix } = {
      ...baseHint,
      quickFix,
    };
    const onApplyFix = vi.fn();
    const onTelemetry = vi.fn();

    renderDrawer({
      safeguards: [hintWithFix],
      onApplyFix,
      onTelemetry,
    });

    const applyFixButton = await screen.findByRole('button', { name: /apply fix/i });
    await user.click(applyFixButton);

    expect(onApplyFix).toHaveBeenCalledWith(hintWithFix, quickFix);
    expect(onTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'apply_fix',
        safeguard: expect.objectContaining({ id: hintWithFix.id }),
        fix: quickFix,
      }),
    );

    expect(approvalFlowTelemetryMock).toHaveBeenCalledWith('safeguard_fix_applied', { hint_id: hintWithFix.id });
  });
});
