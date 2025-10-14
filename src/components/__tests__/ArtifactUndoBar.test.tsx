/// <reference types="vitest" />

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ArtifactUndoBar } from '../ArtifactUndoBar';

describe('ArtifactUndoBar', () => {
  it('disables the undo control once the countdown expires', async () => {
    const now = Date.now();

    const onUndo = vi.fn();
    const onExpired = vi.fn();

    render(
      <ArtifactUndoBar
        summary="Rollback latest action"
        riskTags={['tone']}
        expiresAt={now - 1000}
        onUndo={onUndo}
        onExpired={onExpired}
      />,
    );

    await waitFor(() => expect(onExpired).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /undo expired/i })).toBeDisabled();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('renders risk tags and triggers the undo handler when active', async () => {
    const now = Date.now();

    const onUndo = vi.fn();
    render(
      <ArtifactUndoBar
        summary="Delete reply to ticket #123"
        riskTags={['tone', 'quiet window']}
        expiresAt={now + 60_000}
        onUndo={onUndo}
      />,
    );

    expect(screen.getByText(/Delete reply to ticket/i)).toBeInTheDocument();
    expect(screen.getByText(/tone/i)).toBeInTheDocument();
    expect(screen.getByText(/quiet window/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /undo now/i }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
