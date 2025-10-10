"use client";

import { useMissionStages } from './MissionStageProvider';
import { MissionStage, MISSION_STAGE_ORDER } from './types';
import type { MissionStageState } from './types';

const STAGE_LABELS: Record<MissionStage, string> = {
  [MissionStage.Intake]: 'Intake',
  [MissionStage.Brief]: 'Brief',
  [MissionStage.Toolkits]: 'Toolkits',
  [MissionStage.Inspect]: 'Inspect',
  [MissionStage.Plan]: 'Plan',
  [MissionStage.DryRun]: 'Dry Run',
  [MissionStage.Evidence]: 'Evidence',
  [MissionStage.Feedback]: 'Feedback',
};

function getStateClasses(state: MissionStageState, isCurrent: boolean): string {
  if (state === 'completed') {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  }
  if (state === 'active' || isCurrent) {
    return 'bg-violet-500/20 text-violet-300 border-violet-500/40 ring-2 ring-violet-400/30';
  }
  if (state === 'failed') {
    return 'bg-red-500/20 text-red-300 border-red-500/40';
  }
  return 'bg-slate-500/10 text-slate-400 border-white/10';
}

function getStateBadge(state: MissionStageState): string {
  if (state === 'completed') return '✓';
  if (state === 'active') return '●';
  if (state === 'failed') return '✗';
  return '○';
}

function formatDuration(ms: number | null): string {
  if (!ms) return '';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function MissionStageProgress() {
  const { stages, currentStage, getStageDuration } = useMissionStages();

  return (
    <nav
      aria-label="Mission stage progression"
      className="border-b border-white/10 bg-slate-950/80 px-6 py-4"
    >
      <ol className="flex items-center justify-between gap-2 overflow-x-auto">
        {MISSION_STAGE_ORDER.map((stage, index) => {
          const status = stages.get(stage);
          if (!status) return null;

          const isCurrent = stage === currentStage;
          const duration = getStageDuration(stage);
          const durationText = formatDuration(duration);
          const classes = getStateClasses(status.state, isCurrent);
          const badge = getStateBadge(status.state);
          const isLast = index === MISSION_STAGE_ORDER.length - 1;

          return (
            <li key={stage} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${classes}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center text-xs font-bold"
                  aria-hidden="true"
                >
                  {badge}
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">{STAGE_LABELS[stage]}</span>
                  {durationText && status.state === 'completed' && (
                    <span className="text-[10px] opacity-75">{durationText}</span>
                  )}
                </div>
              </div>
              {!isLast && (
                <span className="h-px w-4 bg-white/20" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
