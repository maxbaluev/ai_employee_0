"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { TimelineMessage } from '@/hooks/useTimelineEvents';
import { useTimelineEvents } from '@/hooks/useTimelineEvents';

type StreamingStatusPanelProps = {
  tenantId: string;
  agentId: string;
  sessionIdentifier: string | null | undefined;
  pollIntervalMs?: number;
  onReviewerRequested?: (event: TimelineMessage) => void;
};

const STATUS_CLASSES: Record<string, string> = {
  complete: 'bg-emerald-400 text-emerald-100',
  in_progress: 'bg-sky-400 text-sky-950 animate-pulse',
  warning: 'bg-amber-400 text-amber-950',
  pending: 'bg-slate-500 text-slate-100',
};

function formatTimestamp(value: string) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch (error) {
    return value;
  }
}

function getStatusClasses(status: TimelineMessage['status']) {
  return STATUS_CLASSES[status] ?? STATUS_CLASSES.pending;
}

export function StreamingStatusPanel({
  tenantId,
  agentId,
  sessionIdentifier,
  pollIntervalMs,
  onReviewerRequested,
}: StreamingStatusPanelProps) {
  const [isPaused, setIsPaused] = useState(false);
  const reviewerAlertRef = useRef<string | null>(null);

  const { events, isLoading, error, refresh, lastUpdated, exitInfo } = useTimelineEvents({
    agentId,
    tenantId,
    sessionIdentifier,
    pollIntervalMs,
    enabled: !isPaused,
  });

  const latestReviewerEvent = useMemo(() => {
    return [...events].filter((event) => event.stage === 'validator_reviewer_requested').pop() ?? null;
  }, [events]);

  const waitingMessage = useMemo(() => {
    if (exitInfo?.missionStatus === 'needs_reviewer') {
      return 'Validator paused the run. Provide a reviewer decision to continue.';
    }
    if (latestReviewerEvent) {
      return 'Validator requested input. Open the approval modal to unblock the mission.';
    }
    const latestWarning = [...events]
      .reverse()
      .find((event) => event.status === 'warning' && event.stage === 'validator_retry');
    if (latestWarning) {
      return 'Validator scheduled a retry. The agent will re-attempt once safeguards are satisfied.';
    }
    return null;
  }, [events, exitInfo?.missionStatus, latestReviewerEvent]);

  const handleReviewerNotify = useCallback(
    (event: TimelineMessage | null) => {
      if (!event || !onReviewerRequested) {
        return;
      }
      if (reviewerAlertRef.current === event.id) {
        return;
      }
      reviewerAlertRef.current = event.id;
      onReviewerRequested(event);
    },
    [onReviewerRequested],
  );

  useEffect(() => {
    handleReviewerNotify(latestReviewerEvent);
  }, [handleReviewerNotify, latestReviewerEvent]);

  const hasSession = Boolean(sessionIdentifier);
  const lastUpdatedLabel = lastUpdated ? formatTimestamp(lastUpdated) : '—';

  const handlePauseToggle = () => {
    if (exitInfo) {
      return;
    }
    setIsPaused((prev) => !prev);
  };

  if (!hasSession) {
    return (
      <section className="flex w-full flex-col gap-4 border-b border-white/10 bg-slate-950/60 px-6 py-8 lg:w-2/5 lg:border-x">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Mission Timeline</h2>
          <span className="text-xs uppercase tracking-wide text-slate-400">Idle</span>
        </header>
        <p className="rounded-lg border border-dashed border-white/15 bg-slate-900/80 p-4 text-sm text-slate-300">
          Generate or accept a mission intake to start recording Copilot timeline events.
        </p>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-col border-b border-white/10 bg-slate-950/60 px-6 py-8 lg:w-2/5 lg:border-x">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Mission Timeline</h2>
          <p className="text-xs text-slate-400">
            {exitInfo ? `Completed ${formatTimestamp(exitInfo.at)}` : `Last sync: ${lastUpdatedLabel}`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handlePauseToggle}
            disabled={Boolean(exitInfo)}
            className="rounded-md border border-white/20 bg-white/5 px-3 py-1 font-medium uppercase tracking-wide text-slate-200 transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={Boolean(exitInfo)}
            className="rounded-md border border-white/20 bg-white/5 px-3 py-1 font-medium uppercase tracking-wide text-slate-200 transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {waitingMessage && !exitInfo && (
        <p className="mt-4 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          {waitingMessage}
        </p>
      )}

      {exitInfo && (
        <p className="mt-4 rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3 text-xs text-emerald-100">
          {exitInfo.missionStatus === 'needs_reviewer'
            ? 'Dry-run paused for reviewer decision. Resume after approvals are recorded.'
            : exitInfo.missionStatus === 'exhausted'
              ? 'Dry-run stopped after exhausting retry budget.'
              : exitInfo.missionStatus === 'error'
                ? 'Dry-run aborted because of an execution error. Review logs for details.'
                : 'Dry-run loop completed and timeline is archived.'}
        </p>
      )}

      <div
        role="log"
        aria-live="polite"
        aria-busy={isLoading}
        className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1 text-sm"
      >
        {events.length === 0 && !isLoading ? (
          <p className="rounded-lg border border-dashed border-white/15 bg-slate-900/80 p-4 text-slate-300">
            Awaiting the first streaming event from CopilotKit.
          </p>
        ) : (
          events.map((event) => {
            const statusClasses = getStatusClasses(event.status);
            const toolCallId = (event.metadata?.tool_call_id as string | undefined) ??
              (event.metadata?.toolCallId as string | undefined) ??
              null;
            const showReviewerCta = event.stage === 'validator_reviewer_requested' && Boolean(onReviewerRequested);

            return (
              <article
                key={event.id}
                className="relative flex gap-4 rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow"
              >
                <div className="flex flex-col items-center">
                  <span className={`flex h-3 w-3 items-center justify-center rounded-full ${statusClasses}`} aria-hidden />
                  <span className="mt-2 h-full w-px flex-1 bg-gradient-to-b from-white/20 to-transparent" aria-hidden />
                </div>
                <div className="flex-1 space-y-2">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">{event.label}</h3>
                    <time className="text-xs uppercase tracking-wide text-slate-400">
                      {formatTimestamp(event.createdAt)}
                    </time>
                  </header>
                  <p className="text-sm text-slate-200">{event.description}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                    {typeof event.metadata.attempt === 'number' && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5">Attempt {event.metadata.attempt}</span>
                    )}
                    {event.stage && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5">{event.stage.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                  {showReviewerCta && (
                    <button
                      type="button"
                      onClick={() => toolCallId && onReviewerRequested?.(event)}
                      disabled={!toolCallId}
                      className="mt-1 inline-flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-200 transition enabled:hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {toolCallId ? 'Open approval modal' : 'Awaiting tool call context'}
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
