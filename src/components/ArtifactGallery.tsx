"use client";

import { useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import { sendTelemetryEvent } from "@/lib/telemetry/client";

export type ArtifactGalleryArtifact = {
  artifact_id: string;
  title: string;
  summary: string;
  status: string;
  hash?: string | null;
  checksum?: string | null;
  evidence_hash?: string | null;
  undo_token?: string | null;
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
  tenantId?: string;
  missionId?: string | null;
  undoButtonTimeout?: number;
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
  tenantId,
  missionId,
  undoButtonTimeout,
  children,
}: ArtifactGalleryProps) {
  const hasArtifacts = artifacts.length > 0;
  const rootClassName = className
    ? `flex flex-col gap-6 ${className}`
    : "flex flex-col gap-6";

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const timeoutDuration = undoButtonTimeout ?? TWENTY_FOUR_HOURS_MS;
  const [undoExpiryMap, setUndoExpiryMap] = useState<Map<string, number>>(() => new Map());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const baseNow = Date.now();
    setUndoExpiryMap((prev) => {
      const next = new Map(prev);
      let mutated = false;
      const seen = new Set<string>();

      artifacts.forEach((artifact) => {
        seen.add(artifact.artifact_id);
        if (artifact.status === "draft") {
          if (!next.has(artifact.artifact_id)) {
            next.set(artifact.artifact_id, baseNow + timeoutDuration);
            mutated = true;
          }
        } else if (next.has(artifact.artifact_id)) {
          next.delete(artifact.artifact_id);
          mutated = true;
        }
      });

      prev.forEach((_, key) => {
        if (!seen.has(key)) {
          next.delete(key);
          mutated = true;
        }
      });

      return mutated ? next : prev;
    });
  }, [artifacts, timeoutDuration]);

  useEffect(() => {
    if (undoExpiryMap.size === 0) {
      return;
    }

    const currentTime = Date.now();
    const futureExpiries = Array.from(undoExpiryMap.values()).filter((expiry) => expiry > now);

    if (futureExpiries.length === 0) {
      return;
    }

    const nextExpiry = Math.min(...futureExpiries);
    let timerId: ReturnType<typeof setTimeout>;

    const scheduleCheck = () => {
      const nextNow = Date.now();
      if (nextNow <= nextExpiry) {
        timerId = setTimeout(scheduleCheck, Math.max(nextExpiry - nextNow, 1));
        return;
      }
      setNow(nextNow);
    };

    timerId = setTimeout(scheduleCheck, Math.max(nextExpiry - currentTime, 0));

    return () => {
      clearTimeout(timerId);
    };
  }, [undoExpiryMap, now]);

  const handleUndoClick = (artifact: ArtifactGalleryArtifact) => {
    onUndo(artifact);
    if (tenantId) {
      void sendTelemetryEvent(tenantId, {
        eventName: "artifact_undo_clicked",
        missionId: missionId ?? undefined,
        eventData: {
          artifact_id: artifact.artifact_id,
          title: artifact.title,
          status: artifact.status,
          undo_token: artifact.undo_token ?? null,
        },
      });
    }
  };

  const visibleArtifacts = useMemo(() => artifacts, [artifacts]);

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
          visibleArtifacts.map((artifact) => {
            const hash =
              artifact.evidence_hash ?? artifact.checksum ?? artifact.hash ?? null;
            const truncatedHash =
              hash && hash.length > 16 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;
            const expiry = undoExpiryMap.get(artifact.artifact_id);
            const showUndo =
              artifact.status === "draft" && (expiry === undefined || expiry > now);

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
                    aria-label={`Download ${artifact.title} as CSV`}
                  >
                    Download CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => onExport(artifact, "pdf")}
                    className="inline-flex items-center gap-2 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-violet-200 transition hover:bg-violet-500/20"
                    aria-label={`Download ${artifact.title} as PDF`}
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => onShare(artifact)}
                    className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:bg-amber-500/20"
                    aria-label={`Copy share link for ${artifact.title}`}
                  >
                    Copy Share Link
                  </button>
                  {showUndo && (
                    <button
                      type="button"
                      onClick={() => handleUndoClick(artifact)}
                      disabled={isUndoing}
                      className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition enabled:hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Undo draft for ${artifact.title}`}
                    >
                      {isUndoing ? "Undoing…" : "Undo draft"}
                    </button>
                  )}
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
