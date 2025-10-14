"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ArtifactUndoBarProps = {
  summary: string | null;
  riskTags?: string[];
  expiresAt: number;
  onUndo: () => void;
  isUndoing?: boolean;
  onExpired?: () => void;
  overrideAllowed?: boolean;
  overrideUrl?: string | null;
  onDismiss?: () => void;
};

const COPY = {
  heading: "Undo available",
  cta: "Undo now",
  disabled: "Undo expired",
  override: "Governance override",
  summaryFallback: "Validator supplied an undo plan you can run for a limited time.",
};

function formatTime(remainingMs: number): string {
  if (remainingMs <= 0) {
    return "00:00";
  }
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function ArtifactUndoBar({
  summary,
  riskTags = [],
  expiresAt,
  onUndo,
  isUndoing = false,
  onExpired,
  overrideAllowed = false,
  overrideUrl,
  onDismiss,
}: ArtifactUndoBarProps) {
  const [now, setNow] = useState(() => Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    if (expiresAt <= Date.now()) {
      expiredRef.current = true;
      onExpired?.();
      return;
    }

    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, onExpired]);

  const remainingMs = Math.max(expiresAt - now, 0);
  const isExpired = remainingMs <= 0;

  useEffect(() => {
    if (isExpired && !expiredRef.current) {
      expiredRef.current = true;
      onExpired?.();
    }
  }, [isExpired, onExpired]);

  const timeLabel = useMemo(() => formatTime(remainingMs), [remainingMs]);
  const displaySummary = summary?.trim() || COPY.summaryFallback;
  const disableUndo = isExpired || isUndoing;

  return (
    <section
      className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-4 text-sm text-amber-100 shadow"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
            <span>{COPY.heading}</span>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-50">
              {timeLabel}
            </span>
          </div>
          <p className="text-amber-50">{displaySummary}</p>
          {riskTags.length > 0 && (
            <div className="flex flex-wrap gap-2" role="list">
              {riskTags.map((tag) => (
                <span
                  key={tag}
                  role="listitem"
                  className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-amber-100"
                >
                  ⚠️ <span>{tag}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <button
            type="button"
            onClick={() => {
              if (!disableUndo) {
                onUndo();
              }
            }}
            disabled={disableUndo}
            className="inline-flex items-center justify-center rounded-md border border-amber-400/50 bg-amber-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-50 transition enabled:hover:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isExpired ? COPY.disabled : isUndoing ? "Undoing…" : COPY.cta}
          </button>
          {overrideAllowed && overrideUrl ? (
            <a
              href={overrideUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-50 transition hover:bg-white/10"
            >
              {COPY.override}
            </a>
          ) : null}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs uppercase tracking-wide text-amber-200 underline underline-offset-4 hover:text-amber-50"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

