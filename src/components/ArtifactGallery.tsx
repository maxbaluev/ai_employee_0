import type { PropsWithChildren } from "react";

export type ArtifactGalleryArtifact = {
  artifact_id: string;
  title: string;
  summary: string;
  status: string;
  hash?: string | null;
  checksum?: string | null;
  evidence_hash?: string | null;
};

type ArtifactGalleryProps = PropsWithChildren<{
  className?: string;
  artifacts: ArtifactGalleryArtifact[];
  onAddPlaceholder: () => void;
  onExport: (artifact: ArtifactGalleryArtifact, format: "csv" | "pdf") => void;
  onShare: (artifact: ArtifactGalleryArtifact) => void;
  onUndo: (artifact: ArtifactGalleryArtifact) => void;
  onCopyHash?: (artifact: ArtifactGalleryArtifact) => void;
  isUndoing?: boolean;
}>;

export function ArtifactGallery({
  className,
  artifacts,
  onAddPlaceholder,
  onExport,
  onShare,
  onUndo,
  onCopyHash,
  isUndoing = false,
  children,
}: ArtifactGalleryProps) {
  const hasArtifacts = artifacts.length > 0;
  const rootClassName = className
    ? `flex flex-col gap-6 ${className}`
    : "flex flex-col gap-6";

  return (
    <section className={rootClassName}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Evidence Gallery</h2>
        <div className="flex items-center gap-3">
          {children}
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:bg-white/15"
            onClick={onAddPlaceholder}
          >
            Add Placeholder
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-300">
        Artifacts track dry-run proof packs before granting credentials.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {hasArtifacts ? (
          artifacts.map((artifact) => {
            const hash =
              artifact.evidence_hash ?? artifact.checksum ?? artifact.hash ?? null;
            const truncatedHash =
              hash && hash.length > 16 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;

            return (
              <article
                key={artifact.artifact_id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-900/80 p-5 shadow"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">{artifact.title}</h3>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-violet-200">
                    {artifact.status}
                  </span>
                </div>

                <p className="text-sm text-slate-300">{artifact.summary}</p>

                {hash ? (
                  <div className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium uppercase tracking-wide text-slate-300">SHA-256</span>
                      {onCopyHash ? (
                        <button
                          type="button"
                          onClick={() => onCopyHash(artifact)}
                          className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
                          aria-label="Copy evidence SHA-256 hash"
                        >
                          Copy
                        </button>
                      ) : null}
                    </div>
                    <code
                      className="mt-1 block overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-slate-300"
                      title={hash}
                    >
                      {truncatedHash}
                    </code>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onExport(artifact, "csv")}
                    className="inline-flex items-center gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-sky-200 transition hover:bg-sky-500/20"
                  >
                    Download CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => onExport(artifact, "pdf")}
                    className="inline-flex items-center gap-2 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-violet-200 transition hover:bg-violet-500/20"
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => onShare(artifact)}
                    className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:bg-amber-500/20"
                  >
                    Copy Share Link
                  </button>
                  <button
                    type="button"
                    onClick={() => onUndo(artifact)}
                    disabled={isUndoing}
                    className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition enabled:hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUndoing ? "Undoing…" : "Undo draft"}
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-white/20 p-8 text-center text-sm text-slate-400">
            Ask the agent to generate a draft artifact to populate this area.
          </div>
        )}
      </div>
    </section>
  );
}

export default ArtifactGallery;
