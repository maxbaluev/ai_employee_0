"use client";

import type { ApprovalSummary } from "@/lib/types/mission";

type ApprovalSummaryCardProps = {
  summary: ApprovalSummary;
};

const SEVERITY_STYLES: Record<ApprovalSummary["safeguards"][number]["severity"], string> = {
  low: "text-slate-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

export function ApprovalSummaryCard({ summary }: ApprovalSummaryCardProps) {
  return (
    <section
      aria-labelledby="approval-summary-heading"
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 print:border-slate-600 print:bg-white"
    >
      <h2
        id="approval-summary-heading"
        className="mb-6 text-lg font-semibold text-slate-100 print:text-slate-900"
      >
        Approval Summary
      </h2>

      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-sm font-medium text-cyan-400 print:text-cyan-700">
            What will happen
          </h3>
          <p className="text-sm text-slate-300 print:text-slate-700">{summary.whatWillHappen}</p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-cyan-400 print:text-cyan-700">
            Who is affected
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <dt className="font-medium text-slate-400 print:text-slate-600">Record count:</dt>
              <dd className="text-slate-300 print:text-slate-700">
                {summary.whoIsAffected.recordCount.toLocaleString()}
              </dd>
            </div>
            <div className="flex items-start gap-2">
              <dt className="font-medium text-slate-400 print:text-slate-600">Segments:</dt>
              <dd className="text-slate-300 print:text-slate-700">
                {summary.whoIsAffected.segments.join(", ")}
              </dd>
            </div>
            <div className="flex items-start gap-2">
              <dt className="font-medium text-slate-400 print:text-slate-600">Data sources:</dt>
              <dd className="text-slate-300 print:text-slate-700">
                {summary.whoIsAffected.dataSources.join(", ")}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-cyan-400 print:text-cyan-700">Safeguards</h3>
          <ul className="space-y-2">
            {summary.safeguards.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 print:border-slate-300 print:bg-slate-50"
              >
                <span
                  className={`text-xs font-medium uppercase tracking-wide ${SEVERITY_STYLES[item.severity]}`}
                  aria-label={`Severity ${item.severity}`}
                >
                  {item.severity}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200 print:text-slate-900">
                    {item.category}
                  </p>
                  <p className="mt-1 text-sm text-slate-400 print:text-slate-700">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-cyan-400 print:text-cyan-700">Undo plan</h3>
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 print:border-slate-300 print:bg-slate-50">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium text-slate-200 print:text-slate-900">{summary.undoPlan.label}</p>
              <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-200 print:bg-cyan-100 print:text-cyan-800">
                {summary.undoPlan.windowMinutes}-minute window
              </span>
            </div>
            <p className="mb-3 text-sm text-slate-400 print:text-slate-700">
              {summary.undoPlan.impactSummary}
            </p>
            <ol className="space-y-1 text-sm text-slate-300 print:text-slate-700">
              {summary.undoPlan.steps.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="font-medium text-slate-500">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-cyan-400 print:text-cyan-700">
            Required permissions
          </h3>
          <ul className="space-y-2">
            {summary.requiredPermissions.map((permission, index) => (
              <li
                key={`${permission.toolkit}-${index}`}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 print:border-slate-300 print:bg-slate-50"
              >
                <p className="mb-2 text-sm font-medium text-slate-200 print:text-slate-900">
                  {permission.toolkit}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {permission.scopes.map((scope) => (
                    <li
                      key={scope}
                      className="rounded-full bg-slate-800/60 px-3 py-1 text-xs text-slate-300 print:bg-slate-200 print:text-slate-700"
                    >
                      {scope}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
