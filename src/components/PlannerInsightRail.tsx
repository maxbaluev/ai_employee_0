"use client";

import { useMemo } from 'react';

import { useTimelineEvents } from '@/hooks/useTimelineEvents';

import type { TimelineMessage } from '@/hooks/useTimelineEvents';

export type PlannerRunRow = Record<string, unknown>;

export type PlannerInsightRailProps = {
  tenantId: string;
  missionId: string | null;
  sessionIdentifier: string | null;
  plannerRuns: PlannerRunRow[];
  onSelectPlay?: (payload: Record<string, unknown>) => void;
  onStageAdvance?: () => void;
};

type PlannerCandidate = {
  id: string;
  title: string;
  impact?: string;
  risk?: string;
  undoPlan?: string;
  confidence?: number;
  toolkits: string[];
  candidateIndex: number;
  mode: string;
  reasonMarkdown?: string;
};

const AGENT_ID = 'control_plane_foundation';

export function PlannerInsightRail({
  tenantId,
  missionId,
  sessionIdentifier,
  plannerRuns,
  onSelectPlay,
  onStageAdvance,
}: PlannerInsightRailProps) {
  const { events } = useTimelineEvents({
    agentId: AGENT_ID,
    tenantId,
    sessionIdentifier,
    enabled: Boolean(sessionIdentifier),
    pollIntervalMs: 5_000,
  });

  const { rankEvent, candidates } = useMemo(() => {
    const rank = [...events]
      .reverse()
      .find((event) => event.stage === 'planner_rank_complete');

    const candidateEvents = events
      .filter((event) => event.stage === 'planner_candidate_summary')
      .map(toPlannerCandidate)
      .sort((a, b) => a.candidateIndex - b.candidateIndex);

    return {
      rankEvent: rank,
      candidates: candidateEvents,
    };
  }, [events]);

  const stats = useMemo(() => {
    const telemetryRow = plannerRuns[0] ?? {};
    const metadata = typeof telemetryRow.metadata === 'object' && telemetryRow.metadata !== null ? telemetryRow.metadata : {};

    const latencyMs = pickNumber([
      rankEvent?.metadata?.latency_ms,
      telemetryRow.latency_ms,
    ]);

    const candidateCount = pickNumber([
      rankEvent?.metadata?.candidate_count,
      telemetryRow.candidate_count,
    ]);

    const similarity = pickNumber([
      rankEvent?.metadata?.average_similarity,
      telemetryRow.embedding_similarity_avg,
    ]);

    return {
      latencyMs,
      candidateCount,
      similarity,
      objective: typeof metadata.objective === 'string' ? metadata.objective : undefined,
    };
  }, [plannerRuns, rankEvent]);

  if (!candidates.length) {
    return (
      <section className="border-b border-white/10 px-6 py-6">
        <h2 className="text-lg font-semibold text-white">Planner insight</h2>
        <p className="mt-2 text-sm text-slate-300">Planner is ranking plays</p>
      </section>
    );
  }

  return (
    <section className="border-b border-white/10 px-6 py-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Planner insight</h2>
          <p className="text-xs text-slate-400 mt-1">
            Review the top-ranked play and proceed to dry-run execution.
          </p>
        </div>
        <div className="text-right text-xs text-slate-300">
          {typeof stats.latencyMs === 'number' && (
            <p>
              Planner latency: <strong>{formatLatency(stats.latencyMs)}</strong>
            </p>
          )}
          {typeof stats.candidateCount === 'number' && (
            <p>
              {stats.candidateCount} {stats.candidateCount === 1 ? 'candidate' : 'candidates'}
            </p>
          )}
        </div>
      </header>

      {candidates.map((candidate) => (
        <article
          key={candidate.id}
          role="article"
          aria-label={candidate.title}
          className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-white">{candidate.title}</h3>
              <div className="mt-2 space-y-1 text-sm text-slate-300">
                {candidate.impact && <p>{candidate.impact} impact</p>}
                {candidate.risk && <p>{candidate.risk} risk</p>}
                {typeof candidate.confidence === 'number' && (
                  <p>Confidence: {candidate.confidence.toFixed(2)}</p>
                )}
                {candidate.undoPlan && <p>Undo plan: {candidate.undoPlan}</p>}
                {candidate.toolkits.length > 0 && (
                  <p>
                    Toolkits: {candidate.toolkits.join(', ')}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const selectionPayload = {
                  title: candidate.title,
                  impact: candidate.impact,
                  risk: candidate.risk,
                  confidence: candidate.confidence,
                  undoPlan: candidate.undoPlan,
                  toolkits: candidate.toolkits,
                  candidateIndex: candidate.candidateIndex,
                  mode: candidate.mode,
                };

                onSelectPlay?.(selectionPayload);
                onStageAdvance?.();
              }}
              className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/20"
            >
              Select this plan
            </button>
          </div>

          {candidate.reasonMarkdown && (
            <ReasonSection markdown={candidate.reasonMarkdown} />
          )}
        </article>
      ))}
    </section>
  );
}

function toPlannerCandidate(event: TimelineMessage): PlannerCandidate {
  const metadata = (event.metadata ?? {}) as Record<string, unknown>;
  const title = typeof metadata.title === 'string' && metadata.title ? metadata.title : event.label;
  const impact = typeof metadata.impact === 'string' ? metadata.impact : undefined;
  const risk = typeof metadata.risk === 'string' ? metadata.risk : undefined;
  const reasonMarkdown = typeof metadata.reason_markdown === 'string' ? metadata.reason_markdown : undefined;
  const toolkitsArray = Array.isArray(metadata.toolkits) ? metadata.toolkits : [];
  const toolkits = toolkitsArray.filter((value): value is string => typeof value === 'string' && value.length > 0);
  const candidateIndex = typeof metadata.candidate_index === 'number' ? metadata.candidate_index : 0;
  const mode = typeof metadata.mode === 'string' && metadata.mode ? metadata.mode : 'dry_run';
  const confidence = typeof metadata.confidence === 'number' ? metadata.confidence : undefined;
  const undoPlan = extractUndoPlan(reasonMarkdown);

  return {
    id: event.id,
    title,
    impact,
    risk,
    undoPlan,
    confidence,
    toolkits,
    candidateIndex,
    mode,
    reasonMarkdown,
  };
}

function extractUndoPlan(markdown?: string): string | undefined {
  if (!markdown) return undefined;
  const lines = markdown.split('\n');
  const undoLine = lines.find((line) => /\*\*Undo plan\*\*/i.test(line));
  if (!undoLine) return undefined;
  return undoLine.replace(/.*\*\*Undo plan\*\*:*/i, '').trim();
}

function formatLatency(latencyMs: number): string {
  const seconds = latencyMs / 1000;
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
}

function pickNumber(values: Array<unknown>): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function ReasonSection({ markdown }: { markdown: string }) {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const heading = lines.find((line) => line.startsWith('### '));
  const bullets = lines.filter((line) => line.startsWith('- '));
  const paragraphs = lines.filter(
    (line) => line !== heading && !bullets.includes(line),
  );

  return (
    <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">
      {heading && <p className="font-semibold">{heading.replace(/^###\s*/, '')}</p>}
      {bullets.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {bullets.map((line, index) => (
            <li key={`bullet-${index}`}>{line.replace(/^-\s*/, '')}</li>
          ))}
        </ul>
      )}
      {paragraphs.map((paragraph, index) => (
        <p key={`paragraph-${index}`}>{paragraph}</p>
      ))}
    </div>
  );
}
