import { CopilotKit } from "@copilotkit/react-core";
import Link from "next/link";
import { ReactNode } from "react";

const STAGE_ORDER = ["define", "prepare", "plan", "execute", "reflect"] as const;

export default function ControlPlaneLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="control_plane_coordinator">
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-900/60 px-8 py-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
                Mission Workspace
              </p>
              <h1 className="text-2xl font-semibold text-slate-100">
                AI Employee Control Plane
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                TODO: swap header copy with live mission context and telemetry hooks
                as outlined in <code>docs/03_user_experience.md</code> and
                <code>docs/04_implementation_guide.md</code> once state stores and
                agents are implemented.
              </p>
            </div>
            <nav className="flex gap-2">
              {STAGE_ORDER.map((stage) => (
                <Link
                  key={stage}
                  className="rounded-full border border-slate-700 px-4 py-1 text-xs uppercase tracking-wide text-slate-300 transition hover:border-cyan-400 hover:text-cyan-200"
                  href={`/workspace/${stage}`}
                >
                  {stage.replace("_", " ")}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-8 py-12">{children}</main>
      </div>
    </CopilotKit>
  );
}
