"use client";

import { useState } from "react";

import type { MissionSafeguard, SafeguardSeverity } from "@/hooks/useMissionIntake";

type SafeguardChecklistProps = {
  safeguards: MissionSafeguard[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (payload: { description: string; severity: SafeguardSeverity }) => void;
  disabled?: boolean;
};

const SEVERITY_OPTIONS: { value: SafeguardSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const SEVERITY_CLASSES: Record<SafeguardSeverity, string> = {
  low: "bg-emerald-500/10 text-emerald-100 border border-emerald-400/30",
  medium: "bg-amber-500/10 text-amber-100 border border-amber-400/30",
  high: "bg-rose-500/10 text-rose-100 border border-rose-400/30",
};

export function SafeguardChecklist({ safeguards, onToggle, onRemove, onAdd, disabled }: SafeguardChecklistProps) {
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<SafeguardSeverity>("medium");

  const handleAdd = () => {
    if (!description.trim() || disabled) {
      return;
    }
    onAdd({ description, severity });
    setDescription("");
    setSeverity("medium");
  };

  return (
    <section
      aria-labelledby="safeguard-checklist-heading"
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm"
    >
      <header className="mb-4">
        <h2 id="safeguard-checklist-heading" className="text-xl font-semibold text-slate-100">
          Safeguard checklist
        </h2>
        <p className="text-sm text-slate-400">
          Generated safeguards appear automatically. Add more if compliance requires extra guardrails.
        </p>
      </header>

      <ul className="space-y-3" aria-live="polite">
        {safeguards.length === 0 && (
          <li className="rounded-lg border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">
            No safeguards yet. Add at least one to satisfy governance review.
          </li>
        )}

        {safeguards.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
              checked={item.completed}
              onChange={() => onToggle(item.id)}
              aria-label={`Mark safeguard '${item.description}' as addressed`}
              disabled={disabled}
            />
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-slate-200">{item.description}</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${SEVERITY_CLASSES[item.severity]}`}>
                  {item.severity.toUpperCase()}
                </span>
                {item.source === "generated" && (
                  <span className="inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-100">
                    Generated
                  </span>
                )}
              </div>
              {item.completed && (
                <p className="text-xs text-slate-500">Marked as addressed.</p>
              )}
            </div>
            {item.source === "manual" && !disabled && (
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition hover:border-red-500/40 hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                aria-label={`Remove safeguard '${item.description}'`}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Add safeguard</h3>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          placeholder="Document the guardrail that keeps this mission safe…"
          disabled={disabled}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="safeguard-severity">
            Severity
          </label>
          <select
            id="safeguard-severity"
            value={severity}
            onChange={(event) => setSeverity(event.target.value as SafeguardSeverity)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            disabled={disabled}
          >
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
          >
            Add safeguard
          </button>
        </div>
      </div>
    </section>
  );
}
