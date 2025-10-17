import type { IntakeStatus } from "@/hooks/useMissionIntake";

const STATUS_COPY: Record<IntakeStatus, string> = {
  idle: "Waiting for mission intent.",
  loading: "Generating mission brief…",
  ready: "Mission brief ready.",
  error: "Generation failed. Update the intent and try again.",
};

type MissionIntakeFormProps = {
  intent: string;
  status: IntakeStatus;
  error: string | null;
  lastUpdated: string | null;
  onIntentChange: (value: string) => void;
  onSubmit: () => void;
  onDismissError: () => void;
};

export function MissionIntakeForm({
  intent,
  status,
  error,
  lastUpdated,
  onIntentChange,
  onSubmit,
  onDismissError,
}: MissionIntakeFormProps) {
  return (
    <section
      aria-labelledby="mission-intake-heading"
      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-sm"
    >
      <header className="mb-6 space-y-1">
        <h2 id="mission-intake-heading" className="text-xl font-semibold text-slate-100">
          Mission intent
        </h2>
        <p className="text-sm text-slate-400">
          Describe the outcome you need in one or two sentences so the agent can assemble a structured brief.
        </p>
      </header>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="space-y-2">
          <label htmlFor="mission-intent" className="text-sm font-medium text-slate-200">
            Mission intent
          </label>
          <textarea
            id="mission-intent"
            value={intent}
            onChange={(event) => onIntentChange(event.target.value)}
            rows={5}
            className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            placeholder="Example: Orchestrate a multi-step outreach to revive dormant manufacturing accounts with clear guardrails on opt-outs and approval checkpoints."
            aria-describedby="mission-intent-help"
          />
          <p id="mission-intent-help" className="text-xs text-slate-500">
            We will generate chips for objective, audience, KPI, timeline, and safeguards based on this intent.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
          >
            <span aria-live="assertive" aria-label="Generation error" className="sr-only">
              Error
            </span>
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={onDismissError}
              className="text-xs font-semibold uppercase tracking-wide text-red-200/80 transition hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
          <span className="text-xs text-slate-400">{STATUS_COPY[status]}</span>
          {lastUpdated && (
            <span className="text-xs text-slate-500">Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-cyan-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Generating…" : "Generate brief"}
          </button>
          <span className="text-xs text-slate-500">
            Target generation time &lt; 3s. Agent narration streams in the Copilot rail.
          </span>
        </div>
      </form>
    </section>
  );
}
