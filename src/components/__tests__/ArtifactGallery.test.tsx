/// <reference types="vitest" />

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ArtifactGallery, type ArtifactGalleryArtifact } from '@/components/ArtifactGallery';

const baseArtifact: ArtifactGalleryArtifact = {
  artifact_id: 'artifact-001',
  title: 'Mission Summary',
  summary: 'Dry-run insights for the upcoming launch.',
  status: 'draft',
};

describe('ArtifactGallery', () => {
  it('renders empty state when no artifacts are provided', () => {
    render(
      <ArtifactGallery
        artifacts={[]}
        onAddPlaceholder={() => {}}
        onExport={() => {}}
        onShare={() => {}}
        onUndo={() => {}}
      />,
    );

    expect(
      screen.getByText('Ask the agent to generate a draft artifact to populate this area.'),
    ).toBeInTheDocument();
  });

  it('lists artifact titles and status badges', () => {
    const artifacts: ArtifactGalleryArtifact[] = [
      baseArtifact,
      {
        artifact_id: 'artifact-002',
        title: 'Undo Plan',
        summary: 'Rollback guidance for the revenue play.',
        status: 'queued',
      },
    ];

    render(
      <ArtifactGallery
        artifacts={artifacts}
        onAddPlaceholder={() => {}}
        onExport={() => {}}
        onShare={() => {}}
        onUndo={() => {}}
      />,
    );

    expect(screen.getByText('Mission Summary')).toBeInTheDocument();
    expect(screen.getByText('Dry-run insights for the upcoming launch.')).toBeInTheDocument();
    expect(screen.getByText('Undo Plan')).toBeInTheDocument();
    expect(screen.getByText('queued')).toBeInTheDocument();
  });

  it('invokes share callback when share link button is pressed', async () => {
    const onShare = vi.fn();
    const user = userEvent.setup();

    render(
      <ArtifactGallery
        artifacts={[baseArtifact]}
        onAddPlaceholder={() => {}}
        onExport={() => {}}
        onShare={onShare}
        onUndo={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: /copy share link/i }));

    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledWith(baseArtifact);
  });

  it('invokes undo callback when undo button is pressed', async () => {
    const onUndo = vi.fn();
    const user = userEvent.setup();

    render(
      <ArtifactGallery
        artifacts={[baseArtifact]}
        onAddPlaceholder={() => {}}
        onExport={() => {}}
        onShare={() => {}}
        onUndo={onUndo}
      />,
    );

    await user.click(screen.getByRole('button', { name: /undo draft/i }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onUndo).toHaveBeenCalledWith(baseArtifact);
  });
});
