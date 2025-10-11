/// <reference types="vitest" />

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SafeguardDrawer, type SafeguardDrawerHint } from '@/components/SafeguardDrawer';

const baseHint: SafeguardDrawerHint = {
  id: 's-1',
  label: 'Keep tone warm-professional',
  hintType: 'tone',
  status: 'suggested',
  confidence: 0.82,
};

describe('SafeguardDrawer', () => {
  it('renders safeguard list with actions', () => {
    render(
      <SafeguardDrawer
        safeguards={[baseHint]}
        onAcceptAll={() => {}}
        onAccept={() => {}}
        onEdit={() => {}}
        onRegenerate={() => {}}
        onTogglePin={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: /safeguards/i })).toBeInTheDocument();
    expect(screen.getByText(baseHint.label)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^accept$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('invokes onAcceptAll when Accept All is clicked and fires telemetry', async () => {
    const onAcceptAll = vi.fn();
    const onTelemetry = vi.fn();
    const user = userEvent.setup();

    render(
      <SafeguardDrawer
        safeguards={[baseHint]}
        onAcceptAll={onAcceptAll}
        onAccept={() => {}}
        onEdit={() => {}}
        onRegenerate={() => {}}
        onTogglePin={() => {}}
        onTelemetry={onTelemetry}
      />,
    );

    await user.click(screen.getByRole('button', { name: /accept all/i }));

    expect(onAcceptAll).toHaveBeenCalledTimes(1);
    expect(onTelemetry).toHaveBeenCalledWith({ type: 'accept_all', safeguard: undefined });
  });

  it('invokes per-safeguard callbacks for accept, edit, regenerate, and pin', async () => {
    const onAccept = vi.fn();
    const onEdit = vi.fn();
    const onRegenerate = vi.fn();
    const onTogglePin = vi.fn();
    const onTelemetry = vi.fn();
    const user = userEvent.setup();

    render(
      <SafeguardDrawer
        safeguards={[baseHint]}
        onAcceptAll={() => {}}
        onAccept={onAccept}
        onEdit={onEdit}
        onRegenerate={onRegenerate}
        onTogglePin={onTogglePin}
        onTelemetry={onTelemetry}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^accept$/i }));
    await user.click(screen.getByRole('button', { name: /^regenerate$/i }));
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    await user.click(screen.getByRole('button', { name: /^pin$/i }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onTogglePin).toHaveBeenCalledWith(baseHint, true);
    expect(onTelemetry).toHaveBeenCalledWith({ type: 'accept', safeguard: baseHint });
    expect(onTelemetry).toHaveBeenCalledWith({ type: 'regenerate', safeguard: baseHint });
    expect(onTelemetry).toHaveBeenCalledWith({ type: 'edit', safeguard: baseHint });
    expect(onTelemetry).toHaveBeenCalledWith({ type: 'toggle_pin', safeguard: baseHint });
  });

  it('toggles pin button label when pressed', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SafeguardDrawer
        safeguards={[baseHint]}
        onAcceptAll={() => {}}
        onAccept={() => {}}
        onEdit={() => {}}
        onRegenerate={() => {}}
        onTogglePin={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^pin$/i }));

    rerender(
      <SafeguardDrawer
        safeguards={[{ ...baseHint, pinned: true }]}
        onAcceptAll={() => {}}
        onAccept={() => {}}
        onEdit={() => {}}
        onRegenerate={() => {}}
        onTogglePin={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /^unpin$/i })).toBeInTheDocument();
  });

  it('toggles history accordion aria-expanded and invokes telemetry', async () => {
    const onHistoryToggle = vi.fn();
    const onTelemetry = vi.fn();
    const user = userEvent.setup();

    render(
      <SafeguardDrawer
        safeguards={[baseHint]}
        historyItems={[{ id: 'h-1', label: 'Quiet hours enforced', status: 'accepted' }]}
        onAcceptAll={() => {}}
        onAccept={() => {}}
        onEdit={() => {}}
        onRegenerate={() => {}}
        onTogglePin={() => {}}
        onHistoryToggle={onHistoryToggle}
        onTelemetry={onTelemetry}
      />,
    );

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
});
