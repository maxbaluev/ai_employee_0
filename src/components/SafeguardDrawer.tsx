"use client";

import { useMemo, useState } from "react";

type SafeguardStatus = "suggested" | "accepted" | "edited" | "rejected" | string;

export type SafeguardDrawerHint = {
  id: string;
  label: string;
  hintType: string;
  status: SafeguardStatus;
  confidence?: number | null;
  pinned?: boolean;
  rationale?: string | null;
  lastUpdatedAt?: string | null;
};

export type SafeguardDrawerHistoryItem = {
  id: string;
  label: string;
  status: SafeguardStatus;
  timestamp?: string | null;
};

type TelemetryPayload = {
  type: string;
  safeguard?: SafeguardDrawerHint;
};

type SafeguardDrawerProps = {
  safeguards: SafeguardDrawerHint[];
  historyItems?: SafeguardDrawerHistoryItem[];
  isBusy?: boolean;
  onAcceptAll: () => void;
  onAccept: (hint: SafeguardDrawerHint) => void;
  onEdit: (hint: SafeguardDrawerHint) => void;
  onRegenerate: (hint: SafeguardDrawerHint) => void;
  onTogglePin: (hint: SafeguardDrawerHint, nextPinned: boolean) => void;
  onHistoryToggle?: (isOpen: boolean) => void;
  onTelemetry?: (payload: TelemetryPayload) => void;
};

function confidenceLabel(value?: number | null): string {
  if (value == null) return "";
  if (value >= 0.85) return "High";
  if (value >= 0.65) return "Medium";
  return "Low";
}

export function SafeguardDrawer({
  safeguards,
  historyItems = [],
  isBusy = false,
  onAcceptAll,
  onAccept,
  onEdit,
  onRegenerate,
  onTogglePin,
  onHistoryToggle,
  onTelemetry,
}: SafeguardDrawerProps) {
  const [isHistoryOpen, setHistoryOpen] = useState(false);

  const activeHints = useMemo(() => safeguards ?? [], [safeguards]);

  const emitTelemetry = (type: string, safeguard?: SafeguardDrawerHint) => {
    onTelemetry?.({ type, safeguard });
  };

  const handleHistoryToggle = () => {
    setHistoryOpen((prev) => {
      const next = !prev;
      onHistoryToggle?.(next);
      emitTelemetry(next ? "history_opened" : "history_closed");
      return next;
    });
  };

  return (
    <aside aria-label="Safeguard Drawer" className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">Safeguards</h2>
          <p className="text-xs text-slate-300">
            Review adaptive safeguards before governed activation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            emitTelemetry("accept_all");
            onAcceptAll();
          }}
          disabled={isBusy || !activeHints.length}
          className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition enabled:hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Accept All
        </button>
      </header>

      <ul className="flex flex-col gap-3" aria-live="polite">
        {activeHints.length === 0 ? (
          <li className="rounded-md border border-dashed border-white/15 px-4 py-3 text-sm text-slate-400">
            No safeguards available. Generate or pin hints from prior missions.
          </li>
        ) : (
          activeHints.map((hint) => {
            const confidence = confidenceLabel(hint.confidence);
            const isPinned = Boolean(hint.pinned);

            return (
              <li
                key={hint.id}
                className="rounded-lg border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{hint.label}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {hint.hintType} {confidence && `· ${confidence} confidence`}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={isPinned}
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
                    onClick={() => {
                      emitTelemetry("toggle_pin", hint);
                      onTogglePin(hint, !isPinned);
                    }}
                  >
                    {isPinned ? "Unpin" : "Pin"}
                  </button>
                </div>

                {hint.rationale ? (
                  <p className="mt-2 text-xs text-slate-300">{hint.rationale}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/20"
                    onClick={() => {
                      emitTelemetry("accept", hint);
                      onAccept(hint);
                    }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200 transition hover:bg-amber-500/20"
                    onClick={() => {
                      emitTelemetry("regenerate", hint);
                      onRegenerate(hint);
                    }}
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-200 transition hover:bg-violet-500/20"
                    onClick={() => {
                      emitTelemetry("edit", hint);
                      onEdit(hint);
                    }}
                  >
                    Edit
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <section className="rounded-md border border-white/10 bg-slate-950/70">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-200"
          aria-expanded={isHistoryOpen}
          onClick={handleHistoryToggle}
        >
          <span>Safeguard History</span>
          <span aria-hidden="true">{isHistoryOpen ? "▲" : "▼"}</span>
        </button>
        {isHistoryOpen ? (
          <ul className="space-y-2 px-4 pb-4 text-xs text-slate-300">
            {historyItems.length === 0 ? (
              <li>No history recorded.</li>
            ) : (
              historyItems.map((item) => (
                <li key={item.id}>
                  <span className="font-semibold text-slate-100">{item.label}</span>
                  {item.status ? ` · ${item.status}` : null}
                  {item.timestamp ? ` · ${item.timestamp}` : null}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </section>
    </aside>
  );
}

export default SafeguardDrawer;
