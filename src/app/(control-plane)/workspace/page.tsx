const STAGE_SUMMARY = [
  {
    id: "define",
    headline: "Mission intake",
    detail:
      "Capture objectives, guardrails, and constraints before delegating work to agents.",
  },
  {
    id: "prepare",
    headline: "Readiness & coverage",
    detail:
      "Audit connected toolkits, request scopes, and surface gaps for stakeholder review.",
  },
  {
    id: "plan",
    headline: "Plan & approve",
    detail:
      "Rank plays, capture rationale, and queue authorization steps for governed execution.",
  },
  {
    id: "execute",
    headline: "Governed execution",
    detail:
      "Run approved actions with telemetry, breakpoints, and undo hooks across providers.",
  },
  {
    id: "reflect",
    headline: "Feedback & evidence",
    detail:
      "Gather observations, annotate artifacts, and promote improvements into the library.",
  },
];

export default function WorkspaceLanding() {
  return (
    <section className="space-y-10">
      <header className="space-y-3">
        <h2 className="text-3xl font-semibold text-slate-100">
          Mission control scaffolding
        </h2>
        <p className="max-w-3xl text-sm text-slate-300">
          The mission workspace is intentionally empty. Use this surface to
          stage foundational components (intake panel, readiness rail, planner,
          execution timeline, evidence gallery) following the implementation
          patterns captured in <code>docs/02_system_overview.md</code> and
          <code>docs/04_implementation_guide.md</code>.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {STAGE_SUMMARY.map((stage) => (
          <article
            key={stage.id}
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-200"
          >
            <h3 className="text-lg font-medium text-slate-100">
              {stage.headline}
            </h3>
            <p className="mt-2 text-slate-300">{stage.detail}</p>
            <p className="mt-4 text-xs text-slate-400">
              TODO: replace with the {stage.id} stage component hierarchy once
              mission state stores, Composio clients, and ADK agents are wired
              up.
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
