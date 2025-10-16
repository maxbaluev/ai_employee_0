"use client";

import { useEffect } from "react";

import { MissionAlert } from "@/lib/types/mission";

type AlertRailProps = {
  alerts: MissionAlert[];
  onAlertsViewed?: (alerts: MissionAlert[]) => void;
};

const SEVERITY_STYLES = {
  info: "border-cyan-500/40 bg-cyan-500/10 text-cyan-100",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-100",
} as const;

export function AlertRail({ alerts, onAlertsViewed }: AlertRailProps) {
  useEffect(() => {
    if (alerts.length > 0) {
      onAlertsViewed?.(alerts);
    }
  }, [alerts, onAlertsViewed]);

  return (
    <section
      aria-labelledby="alert-rail-heading"
      className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <h2 id="alert-rail-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Alert rail
        </h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
          {alerts.length} alerts
        </span>
      </header>
      <ul className="space-y-3" aria-live="polite">
        {alerts.map((alert) => (
          <li key={alert.id} className={`rounded-xl border px-4 py-3 text-sm ${SEVERITY_STYLES[alert.severity]}`}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{alert.message}</p>
                <p className="text-xs text-slate-200/70">
                  Next step: {alert.nextStep}
                </p>
              </div>
              <a
                href={alert.href}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-950 underline transition hover:text-slate-700"
              >
                Go to mission
                <span aria-hidden>→</span>
              </a>
            </div>
          </li>
        ))}
        {alerts.length === 0 && (
          <li className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-sm text-slate-400">
            No outstanding alerts. Validator reminders and blockers will appear here as missions execute.
          </li>
        )}
      </ul>
    </section>
  );
}
