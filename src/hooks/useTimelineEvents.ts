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
};

const DEFAULT_INTERVAL = 5000;
const MAX_EVENTS = 120;
const EXIT_EVENT_KEY = 'copilotkit_exit';

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
  planner_rank_complete: {
    label: 'Planner ranked plays',
    status: 'complete',
    description: (metadata) => {
      const count = typeof metadata.candidate_count === 'number' ? metadata.candidate_count : null;
      return count ? `${count} draft plays queued for validation.` : 'Planner run completed.';
    },
  },
  executor_stage_started: {
    label: 'Execution loop',
    status: 'in_progress',
    description: (metadata) => {
      const attempt = typeof metadata.attempt === 'number' ? metadata.attempt : 1;
      return `Dry-run attempt ${attempt} in progress.`;
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
      return `Validator pass ${attempt} running.`;
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
    label: rawContent || 'Copilot event',
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdatedRef = useRef<string | null>(null);
  const exitInfoRef = useRef<SessionExitInfo | null>(null);
  const [exitInfo, setExitInfo] = useState<SessionExitInfo | null>(null);

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
          const stage =
            metadata.event === EXIT_EVENT_KEY
              ? EXIT_EVENT_KEY
              : stageFromMetadata ?? message.stage;
          const descriptor = coerceDescription(stage, metadata, message.content);
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
          } satisfies TimelineMessage;
        });

        if (mapped.length) {
          lastTimestampRef.current = mapped[mapped.length - 1]?.createdAt ?? lastTimestampRef.current;
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
    if (!sessionIdentifier) {
      setEvents([]);
      lastTimestampRef.current = null;
      lastUpdatedRef.current = null;
      exitInfoRef.current = null;
      setExitInfo(null);
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
  };
}
