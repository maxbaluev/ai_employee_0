import Link from "next/link";

const MISSION_STAGES = [
  {
    id: "define",
    title: "Define",
    description:
      "Capture objectives, guardrails, and mission context before any tools run.",
  },
  {
    id: "prepare",
    title: "Prepare",
    description:
      "Audit toolkit coverage, identify missing scopes, and queue approvals.",
  },
  {
    id: "plan",
    title: "Plan & Approve",
    description:
      "Rank proposed plays, surface safeguards, and gather stakeholder sign-off.",
  },
  {
    id: "execute",
    title: "Execute & Observe",
    description:
      "Run governed actions with live telemetry, pause points, and undo hooks.",
  },
  {
    id: "reflect",
    title: "Reflect & Improve",
    description:
      "Consolidate feedback, evidence, and next steps for continuous learning.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-12 px-8 py-16">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-widest text-cyan-400">
          AI Employee Control Plane
        </p>
        <h1 className="text-4xl font-semibold text-slate-100">
          Mission lifecycle workspace scaffolding
        </h1>
        <p className="max-w-3xl text-base text-slate-300">
          This project is ready to implement the documented control plane UX.
          The current build intentionally contains only guardrail-aligned
          scaffolding so new components, agents, and API routes can be
          implemented directly from <code>docs/</code> without fighting
          CopilotKit demo code.
        </p>
        <Link
          className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-6 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/20"
          href="/workspace"
        >
          Enter mission workspace
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {MISSION_STAGES.map((stage) => (
          <article
            key={stage.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-950/30"
          >
            <h2 className="text-xl font-semibold text-slate-100">
              {stage.title}
            </h2>
            <p className="mt-2 text-sm text-slate-300">{stage.description}</p>
            <Link
              className="mt-4 inline-flex items-center text-sm font-medium text-cyan-300 hover:text-cyan-200"
              href={`/workspace/${stage.id}`}
            >
              View stage blueprint →
            </Link>
          </article>
        ))}
      </section>

      <footer className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
        <p>
          TODO: Replace this page with the real mission intake experience
          outlined in <code>docs/03_user_experience.md</code> and
          <code>docs/04_implementation_guide.md</code>. Keep this staging area
          until foundational components are ready.
        </p>
      </footer>
    </main>
  );
}
