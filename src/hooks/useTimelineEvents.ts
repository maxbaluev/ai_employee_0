"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

type TimelineStageStatus = 'pending' | 'in_progress' | 'complete' | 'warning';

export type TimelineMessage = {
  id: string;
  createdAt: string;
  stage: string | null;
  label: string;
  description: string;
  status: TimelineStageStatus;
  role: string;
  metadata: Record<string, unknown>;
  rawContent: string;
  event: string | null;
};

export type SessionExitInfo = {
  reason: string;
  stage: string | null;
  missionStatus?: string;
  at: string;
};

export type UseTimelineEventsOptions = {
  agentId: string;
  tenantId: string;
  sessionIdentifier: string | null | undefined;
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseTimelineEventsResult = {
  events: TimelineMessage[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: string | null;
  exitInfo: SessionExitInfo | null;
  heartbeatSeconds: number | null;
  lastEventAt: string | null;
};

const DEFAULT_INTERVAL = 5000;
const MAX_EVENTS = 120;
const EXIT_EVENT_KEY = 'copilotkit_exit';
const HEARTBEAT_INTERVAL_MS = 1000;

type StageDescriptor = {
  label: string;
  status: TimelineStageStatus;
  description?: (metadata: Record<string, unknown>, rawContent: string) => string;
};

const STAGE_DESCRIPTORS: Record<string, StageDescriptor> = {
  intake_stage_completed: {
    label: 'Intake ready',
    status: 'complete',
    description: (metadata) =>
      typeof metadata.objective === 'string'
        ? `Objective aligned to “${metadata.objective}”`
        : 'Mission brief captured.',
  },
  planner_stage_started: {
    label: 'Planner initiated',
    status: 'in_progress',
    description: (metadata) => {
      const objective = typeof metadata.objective === 'string' ? metadata.objective : null;
      const audience = typeof metadata.audience === 'string' ? metadata.audience : null;
      if (objective && audience) {
        return `Ranking plays for “${objective}” targeting ${audience}.`;
      }
      if (objective) {
        return `Ranking plays for “${objective}”.`;
      }
      return 'Planner starting candidate ranking.';
    },
  },
  planner_status: {
    label: 'Planner update',
    status: 'in_progress',
    description: (metadata) => {
      const statusType = typeof metadata.status_type === 'string' ? metadata.status_type : 'status';
      if (statusType === 'library_query') {
        const audience = typeof metadata.audience === 'string' ? metadata.audience : 'audience';
        return `Querying library plays for ${audience}.`;
      }
      if (statusType === 'composio_discovery') {
        const toolkitCount = typeof metadata.toolkit_count === 'number' ? metadata.toolkit_count : null;
        return toolkitCount ? `Identified ${toolkitCount} toolkits via Composio.` : 'Discovering toolkits via Composio.';
      }
      if (statusType === 'candidate_ranked') {
        const position = typeof metadata.position === 'number' ? metadata.position : null;
        const title = typeof metadata.title === 'string' ? metadata.title : null;
        const similarity = typeof metadata.similarity === 'number' ? metadata.similarity : null;
        const display = position ? `#${position}` : 'candidate';
        const base = title ? `Ranked ${display}: ${title}` : `Ranked ${display}`;
        return similarity !== null ? `${base} (similarity ${similarity.toFixed(2)}).` : `${base}.`;
      }
      if (statusType === 'fallback_generated') {
        return 'Generated fallback play while catalogue warms up.';
      }
      return 'Planner progressing through ranking steps.';
    },
  },
  planner_rank_complete: {
    label: 'Planner ranked plays',
    status: 'complete',
    description: (metadata) => {
      const count = typeof metadata.candidate_count === 'number' ? metadata.candidate_count : null;
      const similarity = typeof metadata.average_similarity === 'number' ? metadata.average_similarity : null;
      const toolkitList = Array.isArray(metadata.primary_toolkits)
        ? (metadata.primary_toolkits as unknown[]).filter((value) => typeof value === 'string')
        : [];
      const base = count ? `${count} draft plays queued for validation.` : 'Planner run completed.';
      const similarityCopy = similarity !== null ? ` Avg similarity ${similarity.toFixed(2)}.` : '';
      const toolkitCopy = toolkitList.length ? ` Key toolkits: ${toolkitList.join(', ')}.` : '';
      return `${base}${similarityCopy}${toolkitCopy}`.trim();
    },
  },
  executor_stage_started: {
    label: 'Execution loop',
    status: 'in_progress',
    description: (metadata) => {
      const attempt = typeof metadata.attempt === 'number' ? metadata.attempt : 1;
      const playTitle = typeof metadata.play_title === 'string' ? metadata.play_title : null;
      const prefix = `Dry-run attempt ${attempt} in progress`;
      return playTitle ? `${prefix} for ${playTitle}.` : `${prefix}.`;
    },
  },
  executor_status: {
    label: 'Toolkit simulation',
    status: 'in_progress',
    description: (metadata) => {
      const toolkit = typeof metadata.toolkit === 'string' ? metadata.toolkit : 'toolkit';
      const position = typeof metadata.position === 'number' ? metadata.position : null;
      const total = typeof metadata.total === 'number' ? metadata.total : null;
      if (position && total) {
        return `Simulating ${toolkit} (${position} of ${total}).`;
      }
      return `Simulating ${toolkit}.`;
    },
  },
  executor_artifact_created: {
    label: 'Artifact drafted',
    status: 'complete',
    description: (metadata) =>
      typeof metadata.play_title === 'string'
        ? `Draft evidence generated for ${metadata.play_title}.`
        : 'Draft evidence generated.',
  },
  validator_stage_started: {
    label: 'Validator reviewing',
    status: 'in_progress',
    description: (metadata) => {
      const attempt = typeof metadata.attempt === 'number' ? metadata.attempt : 1;
      const safeguards = typeof metadata.safeguard_count === 'number' ? metadata.safeguard_count : null;
      const suffix = safeguards !== null ? ` against ${safeguards} safeguard${safeguards === 1 ? '' : 's'}.` : '.';
      return `Validator pass ${attempt} running${suffix}`;
    },
  },
  validator_feedback: {
    label: 'Validator outcome',
    status: 'complete',
    description: (metadata) => {
      const status = typeof metadata.status === 'string' ? metadata.status : 'reviewed';
      const violations = Array.isArray(metadata.violations) ? metadata.violations : [];
      if (status === 'ask_reviewer') {
        return 'Validator escalated to reviewer.';
      }
      if (status === 'retry_later') {
        return violations.length
          ? `Validator requested retry (${violations.join(', ')}).`
          : 'Validator requested retry.';
      }
      if (status === 'auto_fix') {
        return 'Validator auto-fixed minor guardrail notes.';
      }
      return `Validator result: ${status}.`;
    },
  },
  validator_retry: {
    label: 'Validator retry scheduled',
    status: 'warning',
    description: (metadata) =>
      typeof metadata.status === 'string'
        ? `Validator requested retry (${metadata.status}).`
        : 'Validator retry triggered.',
  },
  validator_reviewer_requested: {
    label: 'Reviewer attention required',
    status: 'warning',
    description: (metadata) =>
      typeof metadata.status === 'string'
        ? `Validator escalated (${metadata.status}).`
        : 'Validator escalated for decision.',
  },
  evidence_stage_started: {
    label: 'Evidence packaging',
    status: 'in_progress',
    description: () => 'Bundling dry-run proof pack.',
  },
  execution_loop_completed: {
    label: 'Dry-run completed',
    status: 'complete',
    description: (metadata) =>
      typeof metadata.attempts === 'number'
        ? `Completed after ${metadata.attempts} attempt${metadata.attempts === 1 ? '' : 's'}.`
        : 'Mission loop completed.',
  },
  execution_loop_exhausted: {
    label: 'Execution halted',
    status: 'warning',
    description: (metadata) =>
      typeof metadata.attempts === 'number'
        ? `Stopped after ${metadata.attempts} attempt${metadata.attempts === 1 ? '' : 's'}.`
        : 'Execution exhausted retry budget.',
  },
  copilotkit_exit: {
    label: 'Mission loop finished',
    status: 'complete',
    description: (metadata, rawContent) => {
      const status = typeof metadata.mission_status === 'string' ? metadata.mission_status : null;
      if (status === 'needs_reviewer') {
        return 'Paused awaiting reviewer decision.';
      }
      if (status === 'exhausted') {
        return 'Stopped after retry budget was exhausted.';
      }
      if (status === 'error') {
        return rawContent || 'Loop aborted because of an error.';
      }
      return rawContent || 'Dry-run loop completed.';
    },
  },
  undo_requested: {
    label: 'Undo requested',
    status: 'warning',
    description: (metadata) => {
      const reason = typeof metadata.reason === 'string' ? metadata.reason : null;
      return reason ? `Undo queued: ${reason}` : 'Undo request queued for evidence service.';
    },
  },
  undo_completed: {
    label: 'Undo completed',
    status: 'complete',
    description: (metadata) => {
      const success = metadata.success === false ? 'failed' : 'succeeded';
      return `Undo ${success}.`;
    },
  },
};

function coerceDescription(
  stage: string | null,
  metadata: Record<string, unknown>,
  rawContent: string,
  eventName: string | null,
): { label: string; status: TimelineStageStatus; description: string } {
  if (stage && stage in STAGE_DESCRIPTORS) {
    const descriptor = STAGE_DESCRIPTORS[stage];
    return {
      label: descriptor.label,
      status: descriptor.status,
      description: descriptor.description ? descriptor.description(metadata, rawContent) : rawContent,
    };
  }

  return {
    label: rawContent || eventName || 'Copilot event',
    status: 'pending',
    description: rawContent,
  };
}

export function useTimelineEvents(options: UseTimelineEventsOptions): UseTimelineEventsResult {
  const { agentId, tenantId, sessionIdentifier, pollIntervalMs = DEFAULT_INTERVAL, enabled = true } = options;

  const [events, setEvents] = useState<TimelineMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTimestampRef = useRef<string | null>(null);
  const lastEventAtRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdatedRef = useRef<string | null>(null);
  const exitInfoRef = useRef<SessionExitInfo | null>(null);
  const [exitInfo, setExitInfo] = useState<SessionExitInfo | null>(null);
  const [heartbeatSeconds, setHeartbeatSeconds] = useState<number | null>(null);

  const buildUrl = useCallback(
    (mode: 'initial' | 'delta') => {
      const params = new URLSearchParams({
        agentId,
        tenantId,
        order: 'asc',
        limit: String(MAX_EVENTS),
      });

      if (sessionIdentifier) {
        params.set('sessionIdentifier', sessionIdentifier);
      }

      if (mode === 'delta' && lastTimestampRef.current) {
        params.set('since', lastTimestampRef.current);
      }

      return `/api/copilotkit/message?${params.toString()}`;
    },
    [agentId, sessionIdentifier, tenantId],
  );

  const mergeEvents = useCallback(
    (incoming: TimelineMessage[], mode: 'initial' | 'delta') => {
      if (!incoming.length) {
        return;
      }

      setEvents((prev) => {
        if (mode === 'initial') {
          return incoming;
        }

        const knownIds = new Set(prev.map((item) => item.id));
        const merged = [...prev];
        for (const item of incoming) {
          if (!knownIds.has(item.id)) {
            merged.push(item);
          }
        }
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return merged.slice(-MAX_EVENTS);
      });
    },
    [],
  );

  const fetchEvents = useCallback(
    async (mode: 'initial' | 'delta') => {
      if (!sessionIdentifier) {
        return;
      }

      setIsLoading(mode === 'initial');
      setError(null);

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(buildUrl(mode), {
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? 'Failed to fetch timeline');
        }

        const payload = (await response.json()) as {
          messages: Array<{
            id: string;
            createdAt: string;
            stage: string | null;
            role: string;
            metadata: Record<string, unknown>;
            content: string;
          }>;
          count: number;
          nextCursor: string | null;
          fetchedAt: string;
        };

        const mapped = payload.messages.map((message) => {
          const metadata = message.metadata ?? {};
          const stageFromMetadata = typeof metadata.stage === 'string' ? metadata.stage : null;
          const eventName = typeof metadata.event === 'string' ? metadata.event : null;
          const stage =
            eventName === EXIT_EVENT_KEY
              ? EXIT_EVENT_KEY
              : stageFromMetadata ?? message.stage;
          const descriptor = coerceDescription(stage, metadata, message.content, eventName);
          return {
            id: message.id,
            createdAt: message.createdAt,
            stage,
            label: descriptor.label,
            description: descriptor.description,
            status: descriptor.status,
            role: message.role,
            metadata,
            rawContent: message.content,
            event: eventName,
          } satisfies TimelineMessage;
        });

        if (mapped.length) {
          lastTimestampRef.current = mapped[mapped.length - 1]?.createdAt ?? lastTimestampRef.current;
          lastEventAtRef.current = mapped[mapped.length - 1]?.createdAt ?? lastEventAtRef.current;
          lastUpdatedRef.current = payload.fetchedAt ?? new Date().toISOString();
        }

        mergeEvents(mapped, mode);

        const exitCandidate = [...mapped]
          .reverse()
          .find((message) => message.metadata?.event === EXIT_EVENT_KEY);
        if (exitCandidate && !exitInfoRef.current) {
          const missionStatus =
            typeof exitCandidate.metadata.mission_status === 'string'
              ? exitCandidate.metadata.mission_status
              : undefined;
          const reason =
            typeof exitCandidate.metadata.reason === 'string'
              ? exitCandidate.metadata.reason
              : missionStatus ?? 'completed';
          const info: SessionExitInfo = {
            reason,
            stage:
              typeof exitCandidate.metadata.stage === 'string'
                ? exitCandidate.metadata.stage
                : exitCandidate.stage,
            missionStatus,
            at: exitCandidate.createdAt,
          };
          exitInfoRef.current = info;
          setExitInfo(info);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      } catch (requestError) {
        if ((requestError as Error).name === 'AbortError') {
          return;
        }
        setError(requestError instanceof Error ? requestError.message : 'Timeline fetch failed.');
      } finally {
        setIsLoading(false);
      }
    },
    [buildUrl, mergeEvents, sessionIdentifier],
  );

  const refresh = useCallback(async () => {
    lastTimestampRef.current = null;
    await fetchEvents('initial');
  }, [fetchEvents]);

  useEffect(() => {
    if (!enabled || !sessionIdentifier || exitInfoRef.current) {
      return undefined;
    }

    void fetchEvents('initial');
    timerRef.current = setInterval(() => {
      void fetchEvents('delta');
    }, pollIntervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = null;
      abortControllerRef.current?.abort();
    };
  }, [enabled, fetchEvents, pollIntervalMs, sessionIdentifier]);

  useEffect(() => {
    if (!enabled || exitInfoRef.current) {
      setHeartbeatSeconds(null);
      return undefined;
    }

    const tick = () => {
      const lastEventAt = lastEventAtRef.current;
      if (!lastEventAt) {
        setHeartbeatSeconds(null);
        return;
      }
      const diffMs = Date.now() - new Date(lastEventAt).getTime();
      setHeartbeatSeconds(Math.max(diffMs / 1000, 0));
    };

    tick();
    const interval = setInterval(tick, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, exitInfo]);

  useEffect(() => {
    if (!sessionIdentifier) {
      setEvents([]);
      lastTimestampRef.current = null;
      lastUpdatedRef.current = null;
      exitInfoRef.current = null;
      setExitInfo(null);
      lastEventAtRef.current = null;
      setHeartbeatSeconds(null);
    }
  }, [sessionIdentifier]);

  const lastUpdated = lastUpdatedRef.current;

  return {
    events,
    isLoading,
    error,
    refresh,
    lastUpdated,
    exitInfo,
    heartbeatSeconds,
    lastEventAt: lastEventAtRef.current,
  };
}
