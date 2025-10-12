"use client";

import { useMemo, useState } from "react";

import { useApprovalFlow } from "@/hooks/useApprovalFlow";

type SafeguardStatus = "suggested" | "accepted" | "edited" | "rejected" | string;

export type SafeguardQuickFix = {
  label: string;
  value: string;
};

export type SafeguardDrawerHint = {
  id: string;
  label: string;
  hintType: string;
  status: SafeguardStatus;
  confidence?: number | null;
  pinned?: boolean;
  rationale?: string | null;
  lastUpdatedAt?: string | null;
  quickFix?: SafeguardQuickFix;
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
  draft?: string;
  fix?: SafeguardQuickFix;
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
  onApplyFix?: (hint: SafeguardDrawerHint, quickFix: SafeguardQuickFix) => void;
  tenantId?: string;
  missionId?: string | null;
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
  onApplyFix,
  tenantId,
  missionId,
}: SafeguardDrawerProps) {
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [editingHintId, setEditingHintId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("\u201c");

  const approvalFlow = useApprovalFlow({ tenantId: tenantId ?? "safeguard-drawer", missionId: missionId ?? null });
  const emitApprovalTelemetry = approvalFlow.emitTelemetry;

  const activeHints = useMemo(() => safeguards ?? [], [safeguards]);

  const emitTelemetry = (payload: TelemetryPayload) => {
    onTelemetry?.(payload);
  };

  const handleHistoryToggle = () => {
    setHistoryOpen((prev) => {
      const next = !prev;
      onHistoryToggle?.(next);
      emitTelemetry({ type: next ? "history_opened" : "history_closed" });
      return next;
    });
  };

  const beginEdit = (hint: SafeguardDrawerHint) => {
    setEditingHintId(hint.id);
    setDraftValue(hint.label);
    emitTelemetry({ type: "edit_start", safeguard: hint });
  };

  const cancelEdit = (hint: SafeguardDrawerHint) => {
    emitTelemetry({ type: "edit_cancel", safeguard: hint, draft: draftValue });
    setEditingHintId(null);
    setDraftValue("");
  };

  const saveEdit = (hint: SafeguardDrawerHint) => {
    const trimmed = draftValue.trim();
    if (!trimmed || trimmed === hint.label) {
      cancelEdit(hint);
      return;
    }

    const timestamp = new Date().toISOString();
    const updatedHint: SafeguardDrawerHint = {
      ...hint,
      label: trimmed,
      status: "edited",
      lastUpdatedAt: timestamp,
    };

    onEdit(updatedHint);
    emitTelemetry({ type: "edit_save", safeguard: updatedHint });
    emitApprovalTelemetry?.("safeguard_edit_saved", { hint_id: hint.id });
    setEditingHintId(null);
    setDraftValue("");
  };

  const handleApplyFix = (hint: SafeguardDrawerHint, quickFix: SafeguardQuickFix) => {
    emitTelemetry({ type: "apply_fix", safeguard: hint, fix: quickFix });
    emitApprovalTelemetry?.("safeguard_fix_applied", { hint_id: hint.id });
    onApplyFix?.(hint, quickFix);
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
            emitTelemetry({ type: "accept_all" });
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
            const isEditing = editingHintId === hint.id;

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
                      emitTelemetry({ type: "toggle_pin", safeguard: hint });
                      onTogglePin(hint, !isPinned);
                    }}
                  >
                    {isPinned ? "Unpin" : "Pin"}
                  </button>
                </div>

                {hint.rationale ? (
                  <p className="mt-2 text-xs text-slate-300">{hint.rationale}</p>
                ) : null}

                {isEditing ? (
                  <div className="mt-3 space-y-2">
                    <label className="sr-only" htmlFor={`safeguard-edit-${hint.id}`}>
                      Edit safeguard
                    </label>
                    <textarea
                      id={`safeguard-edit-${hint.id}`}
                      aria-label="Edit safeguard"
                      className="w-full rounded-md border border-white/15 bg-slate-950/60 p-3 text-sm text-slate-100 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                      value={draftValue}
                      onChange={(event) => setDraftValue(event.target.value)}
                      rows={3}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/30"
                        onClick={() => saveEdit(hint)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
                        onClick={() => cancelEdit(hint)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/20"
                      onClick={() => {
                        emitTelemetry({ type: "accept", safeguard: hint });
                        onAccept(hint);
                      }}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200 transition hover:bg-amber-500/20"
                      onClick={() => {
                        emitTelemetry({ type: "regenerate", safeguard: hint });
                        onRegenerate(hint);
                      }}
                    >
                      Regenerate
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-200 transition hover:bg-violet-500/20"
                      onClick={() => beginEdit(hint)}
                    >
                      Edit
                    </button>
                    {hint.quickFix ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-200 transition hover:bg-cyan-500/20"
                        onClick={() => handleApplyFix(hint, hint.quickFix!)}
                      >
                        Apply Fix
                      </button>
                    ) : null}
                  </div>
                )}
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
