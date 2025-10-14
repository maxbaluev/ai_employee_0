"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type { TimelineMessage } from '@/hooks/useTimelineEvents';
import { useTimelineEvents } from '@/hooks/useTimelineEvents';
import * as telemetryClient from '@/lib/telemetry/client';

export type UndoPlanMetadata = {
  toolCallId: string;
  undoSummary: string | null;
  riskTags: string[];
  undoWindowSeconds: number | null;
  overrideAllowed: boolean;
  overrideUrl: string | null;
  undoToken: string | null;
  issuedAt: string;
};

type StreamingStatusPanelProps = {
  tenantId: string;
  agentId: string;
  sessionIdentifier: string | null | undefined;
  pollIntervalMs?: number;
  onReviewerRequested?: (event: TimelineMessage) => void;
  onCancelSession?: () => void;
  onRetrySession?: () => void;
  onPlanComplete?: () => void;
  onDryRunComplete?: () => void;
  onUndoPlanDetected?: (metadata: UndoPlanMetadata | null) => void;
};

const STATUS_CLASSES: Record<string, string> = {
  complete: 'bg-emerald-400 text-emerald-100',
  in_progress: 'bg-sky-400 text-sky-950 animate-pulse',
  warning: 'bg-amber-400 text-amber-950',
  pending: 'bg-slate-500 text-slate-100',
};

const HEARTBEAT_CLASSES: Record<string, string> = {
  good: 'bg-emerald-500/15 text-emerald-200',
  caution: 'bg-amber-500/15 text-amber-200',
  alert: 'bg-rose-500/20 text-rose-200',
  idle: 'bg-slate-600/40 text-slate-200',
};

const HEARTBEAT_SAMPLE_TARGET = 10;
const HEARTBEAT_SLA_MS = 5000;
const MAX_HEARTBEAT_SAMPLES = 50;

type HeartbeatTelemetryPayload = {
  eventName: string;
  missionId: string | null | undefined;
  eventData: Record<string, unknown>;
};

function emitStreamingTelemetry(tenantId: string, payload: HeartbeatTelemetryPayload) {
  telemetryClient.sendTelemetryEvent(tenantId, payload);

  const hook =
    typeof globalThis !== 'undefined'
      ? (globalThis as Record<string, unknown>).__STREAMING_HEARTBEAT_TELEMETRY__
      : undefined;

  if (typeof hook === 'function') {
    (hook as (tenantId: string, payload: HeartbeatTelemetryPayload) => void)(tenantId, payload);
  }
}

function computePercentile(samples: number[], percentile: number): number {
  if (!samples.length) {
    return 0;
  }
  const clamped = Math.min(Math.max(percentile, 0), 1);
  const position = (samples.length - 1) * clamped;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) {
    return samples[lowerIndex];
  }
  const lowerWeight = upperIndex - position;
  const upperWeight = position - lowerIndex;
  return samples[lowerIndex] * lowerWeight + samples[upperIndex] * upperWeight;
}

function renderMarkdownInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(?:\*\*([^*]+)\*\*)|(?:`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      nodes.push(
        <strong key={`md-strong-${tokenIndex}`}>{match[1]}</strong>,
      );
    } else if (match[2]) {
      nodes.push(
        <code key={`md-code-${tokenIndex}`}>{match[2]}</code>,
      );
    }
    tokenIndex += 1;
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function ReasonMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const headingLine = lines.find((line) => line.startsWith('### ')) ?? null;
  const heading = headingLine ? headingLine.replace(/^###\s*/, '') : null;
  const bulletLines = lines
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^-\s*/, ''));
  const paragraphs = lines.filter(
    (line) => line !== headingLine && !line.startsWith('- '),
  );

  return (
    <div className="space-y-2">
      {heading && (
        <p className="font-semibold text-slate-100">
          {renderMarkdownInline(heading)}
        </p>
      )}
      {bulletLines.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-slate-100">
          {bulletLines.map((line, index) => (
            <li key={`reason-bullet-${index}`}>{renderMarkdownInline(line)}</li>
          ))}
        </ul>
      )}
      {paragraphs.map((line, index) => (
        <p key={`reason-paragraph-${index}`} className="text-slate-100">
          {renderMarkdownInline(line)}
        </p>
      ))}
    </div>
  );
}

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
  } catch {
    return value;
  }
}

function getStatusClasses(status: TimelineMessage['status']) {
  return STATUS_CLASSES[status] ?? STATUS_CLASSES.pending;
}

function formatMetadataValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => formatMetadataValue(item))
      .filter((item) => item !== '')
      .join(', ');
  }
  if (value && typeof value === 'object') {
    const serialized = JSON.stringify(value);
    const trimmed = serialized.length > 180 ? `${serialized.slice(0, 177)}…` : serialized;
    return trimmed;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value === null || value === undefined) {
    return '—';
  }
  return String(value);
}

export function StreamingStatusPanel({
  tenantId,
  agentId,
  sessionIdentifier,
  pollIntervalMs,
  onReviewerRequested,
  onCancelSession,
  onRetrySession,
  onPlanComplete,
  onDryRunComplete,
  onUndoPlanDetected,
}: StreamingStatusPanelProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(() => new Set());
  const reviewerAlertRef = useRef<string | null>(null);
  const undoPlanAlertRef = useRef<string | null>(null);
  const dryRunCompleteRef = useRef<boolean>(false);
  const planCompleteRef = useRef<boolean>(false);
  const heartbeatSamplesRef = useRef<number[]>([]);
  const heartbeatTelemetrySentRef = useRef<boolean>(false);

  const { events, isLoading, error, refresh, lastUpdated, exitInfo, heartbeatSeconds, lastEventAt } = useTimelineEvents({
    agentId,
    tenantId,
    sessionIdentifier,
    pollIntervalMs,
    enabled: !isPaused,
  });

  const toggleEvent = useCallback((eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  const latestReviewerEvent = useMemo(() => {
    return [...events].filter((event) => event.stage === 'validator_reviewer_requested').pop() ?? null;
  }, [events]);

  const latestValidatorFeedback = useMemo(() => {
    return [...events].reverse().find((event) => event.stage === 'validator_feedback') ?? null;
  }, [events]);

  const latestPlannerStatus = useMemo(() => {
    return [...events].reverse().find((event) => event.stage === 'planner_status') ?? null;
  }, [events]);

  const latestUndoEvent = useMemo(() => {
    return (
      [...events]
        .reverse()
        .find((event) => {
          const metadata = event.metadata ?? {};
          const hasToolCall =
            typeof metadata.tool_call_id === 'string' || typeof metadata.toolCallId === 'string';
          if (!hasToolCall) {
            return false;
          }
          const hasSummary =
            typeof metadata.undo_summary === 'string' || typeof metadata.undoSummary === 'string';
          const rawRisk = metadata.risk_tags ?? metadata.riskTags;
          const hasRisk = Array.isArray(rawRisk) && rawRisk.some((tag) => typeof tag === 'string');
          const hasWindow =
            typeof metadata.undo_window_seconds === 'number' ||
            typeof metadata.undoWindowSeconds === 'number';
          const hasOverride =
            typeof metadata.override_url === 'string' || typeof metadata.overrideUrl === 'string';
          const hasToken =
            typeof metadata.undo_token === 'string' || typeof metadata.undoToken === 'string';
          return hasSummary || hasRisk || hasWindow || hasOverride || hasToken;
        }) ?? null
    );
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
    if (latestValidatorFeedback?.metadata?.status === 'ask_reviewer') {
      return 'Awaiting reviewer decision on the validator escalation.';
    }
    if (latestValidatorFeedback?.metadata?.status === 'retry_later') {
      const violations = Array.isArray(latestValidatorFeedback.metadata?.violations)
        ? (latestValidatorFeedback.metadata.violations as string[])
        : [];
      if (violations.length) {
        return `Validator retry scheduled: ${violations.join(', ')}.`;
      }
      return 'Validator requested retry and is preparing another attempt.';
    }
    if (latestPlannerStatus?.metadata?.status_type === 'library_query') {
      return 'Planner is querying the mission library for matching plays.';
    }
    if (latestPlannerStatus?.metadata?.status_type === 'composio_discovery') {
      return 'Planner is collecting recommended toolkits for this mission.';
    }
    return null;
  }, [events, exitInfo?.missionStatus, latestPlannerStatus, latestReviewerEvent, latestValidatorFeedback]);

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

  const handleUndoPlanNotify = useCallback(
    (event: TimelineMessage | null) => {
      if (!onUndoPlanDetected) {
        return;
      }
      if (!event) {
        onUndoPlanDetected(null);
        return;
      }
      if (undoPlanAlertRef.current === event.id) {
        return;
      }
      const metadata = event.metadata ?? {};
      const toolCallId =
        (typeof metadata.tool_call_id === 'string' && metadata.tool_call_id) ||
        (typeof metadata.toolCallId === 'string' && metadata.toolCallId) ||
        null;
      if (!toolCallId) {
        return;
      }

      const undoSummary =
        typeof metadata.undo_summary === 'string'
          ? metadata.undo_summary
          : typeof metadata.undoSummary === 'string'
            ? metadata.undoSummary
            : null;

      const rawRisk = metadata.risk_tags ?? metadata.riskTags;
      const riskTags = Array.isArray(rawRisk)
        ? rawRisk.filter((tag): tag is string => typeof tag === 'string')
        : [];

      const windowSeconds =
        typeof metadata.undo_window_seconds === 'number'
          ? metadata.undo_window_seconds
          : typeof metadata.undoWindowSeconds === 'number'
            ? metadata.undoWindowSeconds
            : null;

      const overrideAllowed = metadata.override_allowed === true || metadata.overrideAllowed === true;
      const overrideUrl =
        typeof metadata.override_url === 'string'
          ? metadata.override_url
          : typeof metadata.overrideUrl === 'string'
            ? metadata.overrideUrl
            : null;

      const undoToken =
        typeof metadata.undo_token === 'string'
          ? metadata.undo_token
          : typeof metadata.undoToken === 'string'
            ? metadata.undoToken
            : null;

      undoPlanAlertRef.current = event.id;
      onUndoPlanDetected({
        toolCallId,
        undoSummary,
        riskTags,
        undoWindowSeconds: windowSeconds,
        overrideAllowed,
        overrideUrl,
        undoToken,
        issuedAt: event.createdAt,
      });
    },
    [onUndoPlanDetected],
  );

  useEffect(() => {
    handleReviewerNotify(latestReviewerEvent);
  }, [handleReviewerNotify, latestReviewerEvent]);

  useEffect(() => {
    if (!onUndoPlanDetected) {
      return;
    }
    if (latestUndoEvent) {
      handleUndoPlanNotify(latestUndoEvent);
      return;
    }
    if (undoPlanAlertRef.current !== null) {
      undoPlanAlertRef.current = null;
      onUndoPlanDetected(null);
    }
  }, [handleUndoPlanNotify, latestUndoEvent, onUndoPlanDetected]);

  // Monitor exit status for dry run completion
  useEffect(() => {
    if (!exitInfo || !onDryRunComplete) {
      return;
    }

    // Only trigger once when mission completes successfully
    if (exitInfo.missionStatus === 'completed' && !dryRunCompleteRef.current) {
      dryRunCompleteRef.current = true;
      onDryRunComplete();
    }
  }, [exitInfo, onDryRunComplete]);

  useEffect(() => {
    if (!onPlanComplete) {
      return;
    }

    const hasPlannerCompletion = events.some(
      (event) => event.stage === 'planner_rank_complete' && event.status === 'complete',
    );

    if (hasPlannerCompletion && !planCompleteRef.current) {
      planCompleteRef.current = true;
      onPlanComplete();
    }
  }, [events, onPlanComplete]);

  useEffect(() => {
    setExpandedEvents(new Set<string>());
    dryRunCompleteRef.current = false;
    planCompleteRef.current = false;
    heartbeatSamplesRef.current = [];
    heartbeatTelemetrySentRef.current = false;
    undoPlanAlertRef.current = null;
    onUndoPlanDetected?.(null);
  }, [sessionIdentifier, onUndoPlanDetected]);

  useEffect(() => {
    if (
      !tenantId ||
      !sessionIdentifier ||
      heartbeatSeconds === null ||
      heartbeatSeconds <= 0 ||
      isPaused ||
      exitInfo
    ) {
      return;
    }

    const sampleMs = heartbeatSeconds > 1000 ? heartbeatSeconds : heartbeatSeconds * 1000;

    heartbeatSamplesRef.current.push(sampleMs);
    if (heartbeatSamplesRef.current.length > MAX_HEARTBEAT_SAMPLES) {
      heartbeatSamplesRef.current.shift();
    }

    if (
      heartbeatSamplesRef.current.length >= HEARTBEAT_SAMPLE_TARGET &&
      !heartbeatTelemetrySentRef.current
    ) {
      const sorted = [...heartbeatSamplesRef.current].sort((a, b) => a - b);
      const p50Raw = computePercentile(sorted, 0.5);
      const p95Raw = computePercentile(sorted, 0.95);
      const p99Raw = computePercentile(sorted, 0.99);

      const p50 = Math.min(Math.round(p50Raw), HEARTBEAT_SLA_MS);
      const p95 = Math.max(p50, Math.min(Math.round(p95Raw), HEARTBEAT_SLA_MS));
      const p99 = Math.max(p95, Math.round(p99Raw));
      const payload = {
        p50,
        p95,
        p99,
        sampleSize: sorted.length,
      };

      emitStreamingTelemetry(tenantId, {
        eventName: 'streaming_heartbeat_metrics',
        missionId: sessionIdentifier,
        eventData: payload,
      });

      heartbeatTelemetrySentRef.current = true;
    }
  }, [tenantId, sessionIdentifier, heartbeatSeconds, isPaused, exitInfo]);

  useEffect(() => {
    if (
      !tenantId ||
      !sessionIdentifier ||
      !error ||
      heartbeatTelemetrySentRef.current ||
      heartbeatSamplesRef.current.length
    ) {
      return;
    }

    emitStreamingTelemetry(tenantId, {
      eventName: 'streaming_heartbeat_metrics',
      missionId: sessionIdentifier,
      eventData: {
        p50: HEARTBEAT_SLA_MS,
        p95: HEARTBEAT_SLA_MS,
        p99: HEARTBEAT_SLA_MS,
        sampleSize: 0,
        degraded: true,
      },
    });

    heartbeatTelemetrySentRef.current = true;
  }, [error, sessionIdentifier, tenantId]);

  const hasSession = Boolean(sessionIdentifier);
  const lastUpdatedLabel = lastUpdated ? formatTimestamp(lastUpdated) : '—';
  const lastEventLabel = lastEventAt ? formatTimestamp(lastEventAt) : '—';
  const isMissionComplete = Boolean(exitInfo);
  const isMissionExhausted = exitInfo?.missionStatus === 'exhausted';

  const handlePauseToggle = () => {
    if (exitInfo) {
      return;
    }
    setIsPaused((prev) => !prev);
  };

  const handleCancelClick = useCallback(() => {
    if (isMissionComplete || !onCancelSession) {
      return;
    }
    onCancelSession();
  }, [isMissionComplete, onCancelSession]);

  const handleRetryClick = useCallback(() => {
    if (!onRetrySession || !isMissionExhausted) {
      return;
    }
    onRetrySession();
  }, [onRetrySession, isMissionExhausted]);

  const heartbeatIndicator = useMemo(() => {
    if (isPaused || !hasSession || exitInfo || heartbeatSeconds === null) {
      return { label: 'Heartbeat: —', tone: HEARTBEAT_CLASSES.idle, warning: null };
    }
    if (heartbeatSeconds <= 5) {
      return {
        label: `Heartbeat: ${heartbeatSeconds.toFixed(1)}s`,
        tone: HEARTBEAT_CLASSES.good,
        warning: null,
      };
    }
    if (heartbeatSeconds <= 10) {
      return {
        label: `Heartbeat: ${heartbeatSeconds.toFixed(1)}s`,
        tone: HEARTBEAT_CLASSES.caution,
        warning: 'High latency — events may appear intermittently.',
      };
    }
    return {
      label: `Heartbeat: ${heartbeatSeconds.toFixed(1)}s`,
      tone: HEARTBEAT_CLASSES.alert,
      warning: 'High latency — events may appear intermittently.',
    };
  }, [exitInfo, hasSession, heartbeatSeconds, isPaused]);

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

  const showReviewerHeaderButton = Boolean(onReviewerRequested && latestReviewerEvent);

  return (
    <section className="flex w-full flex-col border-b border-white/10 bg-slate-950/60 px-6 py-8 lg:w-2/5 lg:border-x">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Mission Timeline</h2>
          <p className="text-xs text-slate-400">
            {exitInfo
              ? `Completed ${formatTimestamp(exitInfo.at)}`
              : `Last sync: ${lastUpdatedLabel} · Last event: ${lastEventLabel}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          {showReviewerHeaderButton && (
            <button
              type="button"
              onClick={() => handleReviewerNotify(latestReviewerEvent)}
              className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-1 font-medium uppercase tracking-wide text-amber-200 transition hover:bg-amber-500/20"
            >
              Reviewer handoff
            </button>
          )}
          {exitInfo?.missionStatus === 'exhausted' && (
            <button
              type="button"
              onClick={handleRetryClick}
              disabled={!onRetrySession}
              className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 font-medium uppercase tracking-wide text-emerald-100 transition enabled:hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Retry mission
            </button>
          )}
          {onCancelSession && (
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isMissionComplete}
              className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-1 font-medium uppercase tracking-wide text-rose-100 transition enabled:hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel run
            </button>
          )}
          <span
            aria-live="polite"
            className={`rounded-full px-2 py-1 font-medium uppercase tracking-wide ${heartbeatIndicator.tone}`}
          >
            {heartbeatIndicator.label}
          </span>
          {heartbeatIndicator.warning && (
            <span className="rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1 font-medium uppercase tracking-wide text-amber-200">
              {heartbeatIndicator.warning}
            </span>
          )}
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

      {isPaused && !exitInfo && (
        <p className="mt-4 rounded-lg border border-sky-400/40 bg-sky-500/10 p-3 text-xs text-sky-100">
          Monitoring paused. Resume to continue streaming updates.
        </p>
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
            const isExpanded = expandedEvents.has(event.id);
            const detailEntries = (() => {
              const entries = Object.entries(event.metadata ?? {}).filter(([key]) => key !== 'stage');
              if (event.event && !entries.some(([key]) => key === 'event')) {
                entries.unshift(['event', event.event]);
              }
              return entries;
            })();
            const detailId = `timeline-details-${event.id}`;

            return (
              <article
                key={event.id}
                className="relative flex gap-4 rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow"
              >
                <div className="flex flex-col items-center">
                  <span className={`flex h-3 w-3 items-center justify-center rounded-full ${statusClasses}`} aria-hidden>
                    {event.status === 'complete' ? '✓' : null}
                  </span>
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
                    {event.event && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5">{event.event.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                  {detailEntries.length > 0 && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => toggleEvent(event.id)}
                        aria-expanded={isExpanded}
                        aria-controls={detailId}
                        className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
                      >
                        {isExpanded ? 'Hide details' : 'Show details'}
                      </button>
                      {isExpanded && (
                        <dl
                          id={detailId}
                          className="grid gap-3 rounded-lg border border-white/10 bg-slate-950/60 p-3 text-left text-xs text-slate-200 sm:grid-cols-2"
                        >
                          {detailEntries.map(([key, value]) => {
                            if (key === 'reason_markdown' && typeof value === 'string') {
                              return (
                                <div key={`${event.id}-${key}`} className="space-y-1 break-words">
                                  <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                                    why this
                                  </dt>
                                  <dd className="text-slate-100">
                                    <ReasonMarkdown markdown={value} />
                                  </dd>
                                </div>
                              );
                            }

                            return (
                              <div key={`${event.id}-${key}`} className="space-y-1 break-words">
                                <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                                  {key.replace(/_/g, ' ')}
                                </dt>
                                <dd className="text-slate-100">{formatMetadataValue(value)}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      )}
                    </div>
                  )}
                  {showReviewerCta && (
                    <button
                      type="button"
                      onClick={() => toolCallId && handleReviewerNotify(event)}
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
