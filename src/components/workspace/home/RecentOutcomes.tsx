"use client";

import { MissionOutcome } from "@/lib/types/mission";

type RecentOutcomesProps = {
  outcomes: MissionOutcome[];
};

export function RecentOutcomes({ outcomes }: RecentOutcomesProps) {
  return (
    <section aria-labelledby="recent-outcomes-heading" className="space-y-4">
      <header>
        <h2 id="recent-outcomes-heading" className="text-lg font-semibold text-slate-100">
          Recent outcomes
        </h2>
        <p className="text-sm text-slate-400">
          Celebrate impact and reuse what worked in future missions.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {outcomes.map((outcome) => (
          <article
            key={outcome.id}
            className="flex h-full flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-lg shadow-slate-950/10"
          >
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-100">
                {outcome.missionTitle}
              </p>
              <p className="text-sm text-slate-300">{outcome.summary}</p>
            </div>
            <dl className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300">
              <div className="rounded-full bg-emerald-500/15 px-3 py-1 font-medium text-emerald-200">
                <dt className="sr-only">Impact</dt>
                <dd>{outcome.impact}</dd>
              </div>
              <div className="rounded-full bg-cyan-500/15 px-3 py-1 font-medium text-cyan-200">
                <dt className="sr-only">Time saved</dt>
                <dd>{outcome.timeSavedHours}h saved</dd>
              </div>
              <div className="rounded-full bg-slate-800 px-3 py-1 font-medium text-slate-200">
                <dt className="sr-only">Owner</dt>
                <dd>{outcome.owner}</dd>
              </div>
              <div className="rounded-full bg-slate-800 px-3 py-1 text-slate-400">
                <dt className="sr-only">Completed</dt>
                <dd>
                  {new Date(outcome.completedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </article>
        ))}
        {outcomes.length === 0 && (
          <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
            Outcome cards will populate after missions reach the Reflect stage and log impact metrics.
          </article>
        )}
      </div>
    </section>
  );
}
