"use client";

import type { ReactNode } from "react";

type MissionBrief = {
  objective: string;
  audience: string;
  kpis: Array<{ label: string; target?: string | null }>;
  safeguards: Array<{ hintType: string | null; text: string }>;
  confidence?: Record<string, number | null>;
  source?: string | null;
};

type MissionBriefCardProps = {
  brief: MissionBrief;
  headerSlot?: ReactNode;
};

function formatConfidence(value: number | null | undefined): string {
  if (value == null) {
    return "–";
  }
  return `${Math.round(value * 100)}%`;
}

export function MissionBriefCard({ brief, headerSlot }: MissionBriefCardProps) {
  const { objective, audience, kpis, safeguards, confidence, source } = brief;
  return (
    <section className="mx-auto mb-6 w-full max-w-6xl px-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-lg">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Mission Brief</h2>
            <p className="text-xs text-slate-400">Pinned summary of accepted intake chips</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide">
            <span className="rounded-full bg-violet-500/15 px-3 py-1 font-semibold text-violet-200">
              Gemini
            </span>
            {headerSlot}
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Objective</h3>
            <p className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm leading-relaxed text-slate-100">
              {objective || "Objective pending"}
            </p>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Confidence: {formatConfidence(confidence?.objective ?? confidence?.goal ?? null)}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Audience</h3>
            <p className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm leading-relaxed text-slate-100">
              {audience || "Audience pending"}
            </p>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Confidence: {formatConfidence(confidence?.audience ?? null)}
            </p>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">KPIs</h3>
          {kpis.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-slate-400">
              No KPIs accepted yet.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {kpis.slice(0, 6).map((kpi, index) => (
                <li
                  key={`${kpi.label}-${index}`}
                  className="rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-slate-100"
                >
                  <span className="font-medium text-white">{kpi.label}</span>
                  {kpi.target && <span className="block text-xs text-slate-400">Target: {kpi.target}</span>}
                </li>
              ))}
            </ul>
          )}
          {kpis.length > 6 && (
            <p className="mt-2 text-xs text-slate-400">{kpis.length - 6} additional KPI(s) available in intake history.</p>
          )}
        </div>

        {safeguards.length > 0 && (
          <div className="border-t border-white/10 pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">Accepted Safeguards</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {safeguards.map((hint, index) => (
                <li
                  key={`${hint.hintType ?? "safeguard"}-${index}`}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100"
                >
                  <span className="block font-semibold text-emerald-200">
                    {hint.hintType ? hint.hintType.replace(/_/g, " ") : "Safeguard"}
                  </span>
                  <span className="text-emerald-100/90">{hint.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
