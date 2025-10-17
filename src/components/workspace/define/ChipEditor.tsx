"use client";

import { useState } from "react";

import type { IntakeStatus, MissionBrief } from "@/hooks/useMissionIntake";

type ConfidenceMeta = {
  score?: number;
  level: "high" | "medium" | "low";
};

const CHIP_LABELS: Record<keyof MissionBrief, string> = {
  objective: "Objective",
  audience: "Audience",
  kpi: "KPI",
  timeline: "Timeline",
  summary: "Summary",
};

const CONFIDENCE_COPY: Record<ConfidenceMeta["level"], string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const CONFIDENCE_CLASSES: Record<ConfidenceMeta["level"], string> = {
  high: "bg-emerald-500/15 text-emerald-200 border border-emerald-400/40",
  medium: "bg-amber-500/15 text-amber-200 border border-amber-400/40",
  low: "bg-rose-500/15 text-rose-200 border border-rose-400/40",
};

type ChipEditorProps = {
  brief: MissionBrief;
  confidences: Record<keyof MissionBrief, ConfidenceMeta | undefined>;
  status: IntakeStatus;
  locked: boolean;
  onChipUpdate: (field: keyof MissionBrief, value: string) => void;
};

export function ChipEditor({ brief, confidences, status, locked, onChipUpdate }: ChipEditorProps) {
  const [editingField, setEditingField] = useState<keyof MissionBrief | null>(null);
  const [draft, setDraft] = useState("");

  const startEditing = (field: keyof MissionBrief) => {
    if (locked || status === "loading") {
      return;
    }
    setEditingField(field);
    setDraft(brief[field]);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setDraft("");
  };

  const saveEditing = () => {
    if (!editingField) {
      return;
    }
    onChipUpdate(editingField, draft.trim());
    setEditingField(null);
  };

  return (
    <section
      aria-labelledby="brief-chips-heading"
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm"
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 id="brief-chips-heading" className="text-xl font-semibold text-slate-100">
            Mission brief chips
          </h2>
          <p className="text-sm text-slate-400">
            Review and fine-tune the generated chips. Confidence badges highlight where to double-check wording.
          </p>
        </div>
        {locked && (
          <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-100">
            Locked
          </span>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(CHIP_LABELS) as (keyof MissionBrief)[]).map((field) => {
          const confidence = confidences[field];
          const isEditing = editingField === field;
          const isMultiline = field === "objective" || field === "summary";

          return (
            <article
              key={field}
              className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              data-field={field}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    {CHIP_LABELS[field]}
                  </h3>
                  {confidence && (
                    <span
                      className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        CONFIDENCE_CLASSES[confidence.level]
                      }`}
                      aria-label={
                        confidence.score !== undefined
                          ? `${CONFIDENCE_COPY[confidence.level]} (${(confidence.score * 100).toFixed(0)}%)`
                          : CONFIDENCE_COPY[confidence.level]
                      }
                    >
                      {CONFIDENCE_COPY[confidence.level]}
                    </span>
                  )}
                </div>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => startEditing(field)}
                    className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={status === "loading"}
                    aria-label={`Edit ${CHIP_LABELS[field]} chip`}
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  {isMultiline ? (
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-cyan-500/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                      autoFocus
                      aria-label={`${CHIP_LABELS[field]} value`}
                    />
                  ) : (
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      className="w-full rounded-lg border border-cyan-500/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                      autoFocus
                      aria-label={`${CHIP_LABELS[field]} value`}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={saveEditing}
                      className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-slate-500 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="min-h-[60px] whitespace-pre-wrap text-sm text-slate-200">
                  {brief[field] ? brief[field] : <span className="text-slate-500">No content yet.</span>}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
