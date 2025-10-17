import { useState } from "react";

import type { IntakeStatus, PersonaKey } from "@/hooks/useMissionIntake";
import {
  DEFAULT_PERSONA,
  PERSONA_SUGGESTIONS,
  getPersonaLabel,
  getPersonaTemplate,
  isExamplePersona,
  normalizePersona,
} from "@/lib/personas";

const STATUS_COPY: Record<IntakeStatus, string> = {
  idle: "Waiting for mission intent.",
  loading: "Generating mission brief…",
  ready: "Mission brief ready.",
  error: "Generation failed. Update the intent and try again.",
};

type MissionIntakeFormProps = {
  intent: string;
  persona: PersonaKey;
  status: IntakeStatus;
  error: string | null;
  lastUpdated: string | null;
  onIntentChange: (value: string) => void;
  onPersonaChange: (value: PersonaKey) => void;
  onTemplateSelect: (value: PersonaKey) => void;
  onSubmit: () => void;
  onDismissError: () => void;
};

export function MissionIntakeForm({
  intent,
  persona,
  status,
  error,
  lastUpdated,
  onIntentChange,
  onPersonaChange,
  onTemplateSelect,
  onSubmit,
  onDismissError,
}: MissionIntakeFormProps) {
  const [customPersona, setCustomPersona] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const normalizedPersona = normalizePersona(persona);
  const personaLabel = getPersonaLabel(persona);
  const personaTemplate = getPersonaTemplate(persona);

  const handleExampleClick = (value: PersonaKey) => {
    onPersonaChange(value);
    setShowCustomInput(false);
  };

  const handleCustomPersonaSubmit = () => {
    const trimmed = customPersona.trim();
    if (!trimmed) {
      return;
    }
    onPersonaChange(trimmed);
    setCustomPersona("");
    setShowCustomInput(false);
  };

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
          Describe the outcome you need. You can pick a persona template or paste free-form intent.
        </p>
      </header>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-200">Persona focus (examples)</p>
            <button
              type="button"
              onClick={() => setShowCustomInput((value) => !value)}
              className="text-xs font-semibold uppercase tracking-wide text-cyan-400 transition hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              {showCustomInput ? "Hide custom" : "+ Custom persona"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERSONA_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.key}
                type="button"
                onClick={() => handleExampleClick(suggestion.key)}
                className={`rounded-full border px-3 py-1 text-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  normalizedPersona === suggestion.key
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                    : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-cyan-500/60 hover:text-cyan-200"
                }`}
                aria-pressed={normalizedPersona === suggestion.key}
              >
                {suggestion.label}
              </button>
            ))}
            {!isExamplePersona(persona) && persona.trim().length > 0 && (
              <span className="rounded-full border border-cyan-400 bg-cyan-500/20 px-3 py-1 text-sm text-cyan-100">
                {persona}
              </span>
            )}
          </div>

          {showCustomInput && (
            <div className="flex gap-2">
              <input
                type="text"
                value={customPersona}
                onChange={(event) => setCustomPersona(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCustomPersonaSubmit();
                  }
                }}
                placeholder="Enter custom persona (e.g., Marketing, Sales, Legal)"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
              <button
                type="button"
                onClick={handleCustomPersonaSubmit}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Set
              </button>
            </div>
          )}

          {normalizedPersona !== DEFAULT_PERSONA && personaTemplate && (
            <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-3 text-sm text-cyan-50">
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="font-medium">Suggested intent for {personaLabel}</span>
                <button
                  type="button"
                  className="rounded-md bg-cyan-600 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  onClick={() => onTemplateSelect(persona)}
                >
                  Use template
                </button>
              </div>
              <p className="text-cyan-100/90">{personaTemplate}</p>
            </div>
          )}
        </div>

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
            Aim for one or two sentences. We will generate chips for objective, audience, KPI, timeline, and safeguards.
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
            Target generation time &lt; 3s. We will stream agent narration in the Copilot rail.
          </span>
        </div>
      </form>
    </section>
  );
}
