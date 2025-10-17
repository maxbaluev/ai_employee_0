import type { MissionBrief, MissionSafeguard } from "@/hooks/useMissionIntake";

type LockBriefModalProps = {
  open: boolean;
  brief: MissionBrief;
  safeguards: MissionSafeguard[];
  onConfirm: () => void;
  onClose: () => void;
};

const BRIEF_FIELDS: Array<{ key: keyof MissionBrief; label: string }> = [
  { key: "objective", label: "Objective" },
  { key: "audience", label: "Audience" },
  { key: "kpi", label: "KPI" },
  { key: "timeline", label: "Timeline" },
  { key: "summary", label: "Summary" },
];

export function LockBriefModal({ open, brief, safeguards, onConfirm, onClose }: LockBriefModalProps) {
  if (!open) {
    return null;
  }

  const missingSafeguards = safeguards.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-brief-heading"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div>
            <h2 id="lock-brief-heading" className="text-lg font-semibold text-slate-100">
              Lock mission brief
            </h2>
            <p className="text-sm text-slate-400">
              Review the generated chips and safeguards. Locking the brief signals the mission is ready for the Prepare stage.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-slate-500 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Close
          </button>
        </header>

        <div className="grid max-h-[60vh] grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-2">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Mission brief
            </h3>
            <ul className="space-y-3">
              {BRIEF_FIELDS.map(({ key, label }) => (
                <li key={key} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-sm text-slate-100">
                    {brief[key] ? brief[key] : <span className="text-slate-500">No content provided.</span>}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Safeguards
            </h3>
            {missingSafeguards && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                No safeguards captured. Governance review expects at least one guardrail before locking.
              </div>
            )}
            <ul className="space-y-3">
              {safeguards.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-100">
                  <p>{item.description}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 uppercase tracking-wide">
                      {item.severity}
                    </span>
                    <span className="rounded-full border border-cyan-400/40 px-2 py-0.5 uppercase tracking-wide text-cyan-100">
                      {item.source}
                    </span>
                    {item.completed && <span className="text-emerald-300">Addressed</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/60 px-6 py-4">
          <p className="text-xs text-slate-400">
            Locking freezes Stage 1 and emits telemetry for readiness dashboards.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Confirm lock
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
