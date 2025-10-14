/// <reference types="vitest" />

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';

import { ArtifactGallery, ArtifactGalleryArtifact } from '../ArtifactGallery';

const sendTelemetryEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/telemetry/client', () => ({
  sendTelemetryEvent: sendTelemetryEventMock,
}));

describe('ArtifactGallery undo affordance', () => {
  const baseArtifact: ArtifactGalleryArtifact = {
    artifact_id: 'artifact-123',
    title: 'Dry-run proof pack',
    summary: 'Planner dry-run output',
    status: 'draft',
    hash: 'abcd1234',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    sendTelemetryEventMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps undo CTA visible for 24 hours after artifact creation and emits telemetry on click', async () => {
    const onUndo = vi.fn();
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTimeAsync,
      delay: null,
      pointerEventsCheck: 'never',
    });

    render(
      <ArtifactGallery
        artifacts={[baseArtifact]}
        onExport={vi.fn()}
        onShare={vi.fn()}
        onUndo={onUndo}
        tenantId="tenant-1"
        missionId="mission-1"
        undoButtonTimeout={1000}
      />,
    );

    const undoButton = screen.getByRole('button', {
      name: /Undo draft for Dry-run proof pack/i,
    });
    expect(undoButton).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(900);
      vi.runOnlyPendingTimers();
    });
    expect(
      screen.getByRole('button', { name: /Undo draft for Dry-run proof pack/i }),
    ).toBeInTheDocument();

    await act(async () => {
      void user.click(undoButton);
      await vi.runOnlyPendingTimersAsync();
    });
    expect(onUndo).toHaveBeenCalledWith(baseArtifact);
    expect(sendTelemetryEventMock).toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(200);
      await vi.runOnlyPendingTimersAsync();
    });
    expect(
      screen.queryByRole('button', { name: /Undo draft for Dry-run proof pack/i }),
    ).not.toBeInTheDocument();
  });
});
