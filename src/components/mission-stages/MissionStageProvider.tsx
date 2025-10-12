"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { sendTelemetryEvent } from '@/lib/telemetry/client';
import { MissionStage, MISSION_STAGE_ORDER } from './types';
import type { MissionStageStatus, MissionStagesMap } from './types';

type MissionStageContextValue = {
  stages: MissionStagesMap;
  currentStage: MissionStage;
  markStageStarted: (stage: MissionStage, metadata?: Record<string, unknown>) => void;
  markStageCompleted: (stage: MissionStage, metadata?: Record<string, unknown>) => void;
  markStageFailed: (stage: MissionStage, metadata?: Record<string, unknown>) => void;
  hydrateStages: (snapshot: Array<{
    stage: MissionStage;
    state: MissionStageStatus['state'];
    startedAt?: Date | string | null;
    completedAt?: Date | string | null;
    metadata?: Record<string, unknown> | null;
    locked?: boolean;
  }> | null | undefined) => void;
  getNextStage: (stage: MissionStage) => MissionStage | null;
  getStageDuration: (stage: MissionStage) => number | null;
};

const MissionStageContext = createContext<MissionStageContextValue | null>(null);

type MissionStageProviderProps = {
  children: ReactNode;
  tenantId: string;
  missionId: string | null;
};

type PendingTelemetryEvent =
  | {
      kind: 'started';
      stage: MissionStage;
      timestamp: string;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: 'completed' | 'failed';
      stage: MissionStage;
      timestamp: string;
      duration: number;
      metadata?: Record<string, unknown>;
    };

function initializeStages(): MissionStagesMap {
  const map = new Map<MissionStage, MissionStageStatus>();

  MISSION_STAGE_ORDER.forEach((stage, index) => {
    map.set(stage, {
      stage,
      state: index === 0 ? 'active' : 'pending',
      startedAt: index === 0 ? new Date() : null,
      completedAt: null,
      locked: false,
      metadata: {},
    });
  });

  return map;
}

export function MissionStageProvider({
  children,
  tenantId,
  missionId,
}: MissionStageProviderProps) {
  const [stages, setStages] = useState<MissionStagesMap>(initializeStages);
  const pendingTelemetryRef = useRef<PendingTelemetryEvent[]>([]);

  const enqueueTelemetry = useCallback((event: PendingTelemetryEvent) => {
    pendingTelemetryRef.current.push(event);
  }, []);

  const activeStage = useMemo(() => {
    for (const status of stages.values()) {
      if (status.state === 'active') {
        return status.stage;
      }
    }

    for (let index = MISSION_STAGE_ORDER.length - 1; index >= 0; index -= 1) {
      const stage = MISSION_STAGE_ORDER[index];
      const status = stages.get(stage);
      if (status?.state === 'completed') {
        return stage;
      }
    }

    return MissionStage.Intake;
  }, [stages]);

  const getNextStage = useCallback((stage: MissionStage): MissionStage | null => {
    const currentIndex = MISSION_STAGE_ORDER.indexOf(stage);
    if (currentIndex === -1 || currentIndex >= MISSION_STAGE_ORDER.length - 1) {
      return null;
    }
    return MISSION_STAGE_ORDER[currentIndex + 1];
  }, []);

  const getStageDuration = useCallback((stage: MissionStage): number | null => {
    const status = stages.get(stage);
    if (!status?.startedAt) {
      return null;
    }
    const endTime = status.completedAt ?? new Date();
    return endTime.getTime() - status.startedAt.getTime();
  }, [stages]);

  const markStageStarted = useCallback(
    (stage: MissionStage, metadata?: Record<string, unknown>) => {
      setStages((prev) => {
        const current = prev.get(stage);
        if (!current) {
          return prev;
        }

        if (current.state === 'failed' || current.state === 'completed') {
          return prev;
        }

        const allowedToStart = (() => {
          const currentActiveStage =
            Array.from(prev.values()).find((status) => status.state === 'active')?.stage ?? MissionStage.Intake;

          if (current.state === 'active') {
            return true;
          }

          const requestedIndex = MISSION_STAGE_ORDER.indexOf(stage);
          const currentIndex = MISSION_STAGE_ORDER.indexOf(currentActiveStage);

          if (requestedIndex === -1 || currentIndex === -1) {
            return false;
          }

          if (requestedIndex !== currentIndex && requestedIndex !== currentIndex + 1) {
            return false;
          }

          if (requestedIndex === currentIndex + 1) {
            const currentState = prev.get(currentActiveStage);
            if (!currentState || currentState.state !== 'completed') {
              return false;
            }
          }

          return true;
        })();

        if (!allowedToStart) {
          return prev;
        }

        const next = new Map(prev);
        const startedAt = current.startedAt ?? new Date();

        next.set(stage, {
          ...current,
          state: 'active',
          startedAt,
          metadata: { ...current.metadata, ...(metadata ?? {}) },
        });

        enqueueTelemetry({
          kind: 'started',
          stage,
          timestamp: startedAt.toISOString(),
          metadata,
        });

        return next;
      });
    },
    [enqueueTelemetry]
  );

  const markStageCompleted = useCallback(
    (stage: MissionStage, metadata?: Record<string, unknown>) => {
      setStages((prev) => {
        const current = prev.get(stage);
        if (!current) {
          return prev;
        }

        const now = new Date();
        const startedAt = current.startedAt ?? now;
        const duration = Math.max(0, now.getTime() - startedAt.getTime());
        const next = new Map(prev);

        next.set(stage, {
          ...current,
          state: 'completed',
          completedAt: now,
          metadata: { ...current.metadata, ...(metadata ?? {}) },
        });

        enqueueTelemetry({
          kind: 'completed',
          stage,
          timestamp: now.toISOString(),
          duration,
          metadata,
        });

        const nextStage = getNextStage(stage);
        if (nextStage) {
          const nextStatus = next.get(nextStage);
          if (nextStatus && nextStatus.state !== 'failed') {
            const nextStartedAt = nextStatus.startedAt ?? now;
            next.set(nextStage, {
              ...nextStatus,
              state: 'active',
              startedAt: nextStartedAt,
            });
            enqueueTelemetry({
              kind: 'started',
              stage: nextStage,
              timestamp: nextStartedAt.toISOString(),
            });
          }
        }

        return next;
      });
    },
    [enqueueTelemetry, getNextStage]
  );

  const markStageFailed = useCallback(
    (stage: MissionStage, metadata?: Record<string, unknown>) => {
      setStages((prev) => {
        const current = prev.get(stage);
        if (!current) {
          return prev;
        }

        const now = new Date();
        const startedAt = current.startedAt ?? now;
        const duration = Math.max(0, now.getTime() - startedAt.getTime());
        const next = new Map(prev);

        next.set(stage, {
          ...current,
          state: 'failed',
          completedAt: now,
          locked: true,
          metadata: { ...current.metadata, ...(metadata ?? {}) },
        });

        enqueueTelemetry({
          kind: 'failed',
          stage,
          timestamp: now.toISOString(),
          duration,
          metadata,
        });

        return next;
      });
    },
    [enqueueTelemetry]
  );

  const hydrateStages = useCallback<
    MissionStageContextValue['hydrateStages']
  >((entries) => {
    if (!Array.isArray(entries) || entries.length === 0) {
      return;
    }

    const coerceDate = (value: Date | string | number | null | undefined): Date | null => {
      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
      }
      if (typeof value === 'string' || typeof value === 'number') {
        const candidate = new Date(value);
        return Number.isNaN(candidate.getTime()) ? null : candidate;
      }
      return null;
    };

    setStages((prev) => {
      let mutated = false;
      const next = new Map(prev);

      entries.forEach((entry) => {
        if (!entry || typeof entry.stage !== 'string' || typeof entry.state !== 'string') {
          return;
        }

        const stage = entry.stage as MissionStage;
        if (!MISSION_STAGE_ORDER.includes(stage)) {
          return;
        }

        const status = next.get(stage);
        if (!status) {
          return;
        }

        const nextStatus: MissionStageStatus = {
          ...status,
          state: entry.state,
          startedAt:
            entry.startedAt !== undefined ? coerceDate(entry.startedAt) : status.startedAt,
          completedAt:
            entry.completedAt !== undefined ? coerceDate(entry.completedAt) : status.completedAt,
          metadata:
            entry.metadata !== undefined && entry.metadata !== null
              ? { ...entry.metadata }
              : status.metadata,
          locked:
            entry.locked !== undefined ? entry.locked : entry.state === 'failed' ? true : status.locked,
        };

        const original = next.get(stage);
        next.set(stage, nextStatus);

        if (
          !original ||
          original.state !== nextStatus.state ||
          (original.startedAt?.getTime() ?? null) !== (nextStatus.startedAt?.getTime() ?? null) ||
          (original.completedAt?.getTime() ?? null) !== (nextStatus.completedAt?.getTime() ?? null) ||
          original.locked !== nextStatus.locked ||
          original.metadata !== nextStatus.metadata
        ) {
          mutated = true;
        }
      });

      return mutated ? next : prev;
    });
  }, []);

  useEffect(() => {
    if (pendingTelemetryRef.current.length === 0) {
      return;
    }

    const events = pendingTelemetryRef.current.splice(0, pendingTelemetryRef.current.length);

    events.forEach((event) => {
      if (event.kind === 'started') {
        void sendTelemetryEvent(tenantId, {
          eventName: `stage_${event.stage}_started`,
          missionId,
          eventData: {
            stage: event.stage,
            timestamp: event.timestamp,
            ...(event.metadata ?? {}),
          },
        });
      } else if (event.kind === 'completed') {
        void sendTelemetryEvent(tenantId, {
          eventName: `stage_${event.stage}_completed`,
          missionId,
          eventData: {
            stage: event.stage,
            timestamp: event.timestamp,
            duration: event.duration,
            ...(event.metadata ?? {}),
          },
        });
      } else {
        void sendTelemetryEvent(tenantId, {
          eventName: `stage_${event.stage}_failed`,
          missionId,
          eventData: {
            stage: event.stage,
            timestamp: event.timestamp,
            duration: event.duration,
            ...(event.metadata ?? {}),
          },
        });
      }
    });
  }, [stages, tenantId, missionId]);

  const contextValue = useMemo(
    () => ({
      stages,
      currentStage: activeStage,
      markStageStarted,
      markStageCompleted,
      markStageFailed,
      hydrateStages,
      getNextStage,
      getStageDuration,
    }),
    [
      stages,
      activeStage,
      markStageStarted,
      markStageCompleted,
      markStageFailed,
      hydrateStages,
      getNextStage,
      getStageDuration,
    ]
  );

  return (
    <MissionStageContext.Provider value={contextValue}>
      {children}
    </MissionStageContext.Provider>
  );
}

export function useMissionStages(): MissionStageContextValue {
  const context = useContext(MissionStageContext);

  if (!context) {
    throw new Error('useMissionStages must be used within a MissionStageProvider');
  }

  return context;
}
