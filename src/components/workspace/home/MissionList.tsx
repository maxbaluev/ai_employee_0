"use client";

import { useEffect, useMemo } from "react";

import { MissionSummary, ReadinessState } from "@/lib/types/mission";

type MissionListProps = {
  missions: MissionSummary[];
  onMissionSelect?: (mission: MissionSummary) => void;
  onBadgeVisible?: (mission: MissionSummary) => void;
};

const READINESS_LABEL: Record<ReadinessState, string> = {
  ready: "Ready",
  "needs-auth": "Needs auth",
  "needs-data": "Needs data",
  blocked: "Blocked",
};

const READINESS_CLASSNAMES: Record<ReadinessState, string> = {
  ready: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  "needs-auth": "bg-amber-500/15 text-amber-300 ring-amber-500/40",
  "needs-data": "bg-blue-500/15 text-blue-300 ring-blue-500/40",
  blocked: "bg-rose-500/15 text-rose-300 ring-rose-500/40",
};

function formatRelativeTimestamp(isoTimestamp: string) {
  const updatedAt = new Date(isoTimestamp).getTime();
  const now = Date.now();
  const deltaMs = updatedAt - now;
  const deltaMinutes = Math.round(deltaMs / (1000 * 60));

  const relativeFormatter = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  });

  if (Math.abs(deltaMinutes) < 60) {
    return relativeFormatter.format(Math.round(deltaMinutes), "minutes");
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) {
    return relativeFormatter.format(deltaHours, "hours");
  }

  const deltaDays = Math.round(deltaHours / 24);
  return relativeFormatter.format(deltaDays, "days");
}

export function MissionList({
  missions,
  onMissionSelect,
  onBadgeVisible,
}: MissionListProps) {
  const sortedMissions = useMemo(
    () =>
      [...missions].sort((a, b) =>
        a.readiness === b.readiness
          ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          : a.readiness.localeCompare(b.readiness),
      ),
    [missions],
  );

  useEffect(() => {
    if (!onBadgeVisible) {
      return;
    }

    sortedMissions.forEach((mission) => onBadgeVisible(mission));
  }, [sortedMissions, onBadgeVisible]);

  return (
    <section aria-labelledby="mission-list-heading" className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2
            id="mission-list-heading"
            className="text-xl font-semibold text-slate-100"
          >
            My missions
          </h2>
          <p className="text-sm text-slate-400">
            Track stage, readiness, and next actions across active missions.
          </p>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wide text-slate-500">
            {sortedMissions.length} active
          </span>
        </div>
      </header>
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
        <table
          aria-labelledby="mission-list-heading"
          className="min-w-full text-left text-sm text-slate-200"
        >
          <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">
                Mission
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Stage
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Owner
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Readiness
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Next action
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Updated
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                <span className="sr-only">Open mission</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sortedMissions.map((mission) => (
              <tr
                key={mission.id}
                className="transition hover:bg-slate-800/40 focus-within:bg-slate-800/60"
              >
                <th scope="row" className="px-5 py-4 font-medium">
                  {mission.title}
                </th>
                <td className="px-5 py-4 capitalize text-slate-300">
                  {mission.stage}
                </td>
                <td className="px-5 py-4 text-slate-300">{mission.owner}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${READINESS_CLASSNAMES[mission.readiness]}`}
                    data-readiness={mission.readiness}
                  >
                    <span className="inline-block h-2 w-2 rounded-full bg-current" />
                    {READINESS_LABEL[mission.readiness]}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-300">{mission.nextAction}</td>
                <td className="px-5 py-4 text-slate-400">
                  {formatRelativeTimestamp(mission.updatedAt)}
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    aria-label={`Open ${mission.title}`}
                    onClick={() => onMissionSelect?.(mission)}
                    className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-medium text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/10"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
