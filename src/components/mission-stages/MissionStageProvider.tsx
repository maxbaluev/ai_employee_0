"use client";

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
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
  getNextStage: (stage: MissionStage) => MissionStage | null;
  getStageDuration: (stage: MissionStage) => number | null;
};

const MissionStageContext = createContext<MissionStageContextValue | null>(null);

type MissionStageProviderProps = {
  children: ReactNode;
  tenantId: string;
  missionId: string | null;
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
  const [currentStage, setCurrentStage] = useState<MissionStage>(MissionStage.Intake);

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
      let stageUpdated = false;

      setStages((prev) => {
        const current = prev.get(stage);
        if (!current) {
          return prev;
        }

        if (current.state === 'failed' || current.state === 'completed') {
          return prev;
        }

        const next = new Map(prev);
        const updatedStage: MissionStageStatus = {
          ...current,
          state: 'active',
          startedAt: current.startedAt ?? new Date(),
          metadata: { ...current.metadata, ...metadata },
        };

        next.set(stage, updatedStage);
        stageUpdated = true;
        return next;
      });

      if (stageUpdated) {
        setCurrentStage(stage);

        void sendTelemetryEvent(tenantId, {
          eventName: `stage_${stage}_started`,
          missionId,
          eventData: {
            stage,
            timestamp: new Date().toISOString(),
            ...metadata,
          },
        });
      }
    },
    [tenantId, missionId]
  );

  const markStageCompleted = useCallback(
    (stage: MissionStage, metadata?: Record<string, unknown>) => {
      const duration = getStageDuration(stage);

      setStages((prev) => {
        const next = new Map(prev);
        const current = next.get(stage);

        if (!current) return prev;

        const now = new Date();
        next.set(stage, {
          ...current,
          state: 'completed',
          completedAt: now,
          metadata: { ...current.metadata, ...metadata },
        });

        // Automatically start next stage
        const nextStage = getNextStage(stage);
        if (nextStage) {
          const nextStatus = next.get(nextStage);
          if (nextStatus && nextStatus.state !== 'failed') {
            next.set(nextStage, {
              ...nextStatus,
              state: 'active',
              startedAt: nextStatus.startedAt ?? now,
            });
            setCurrentStage(nextStage);
          }
        }

        return next;
      });

      // Emit completion telemetry
      void sendTelemetryEvent(tenantId, {
        eventName: `stage_${stage}_completed`,
        missionId,
        eventData: {
          stage,
          timestamp: new Date().toISOString(),
          duration,
          ...metadata,
        },
      });

      // Emit started telemetry for next stage
      const nextStage = getNextStage(stage);
      if (nextStage) {
        void sendTelemetryEvent(tenantId, {
          eventName: `stage_${nextStage}_started`,
          missionId,
          eventData: {
            stage: nextStage,
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
    [tenantId, missionId, getStageDuration, getNextStage]
  );

  const markStageFailed = useCallback(
    (stage: MissionStage, metadata?: Record<string, unknown>) => {
      const duration = getStageDuration(stage);

      setStages((prev) => {
        const next = new Map(prev);
        const current = next.get(stage);

        if (!current) return prev;

        next.set(stage, {
          ...current,
          state: 'failed',
          completedAt: new Date(),
          locked: true,
          metadata: { ...current.metadata, ...metadata },
        });

        return next;
      });

      // Emit failure telemetry
      void sendTelemetryEvent(tenantId, {
        eventName: `stage_${stage}_failed`,
        missionId,
        eventData: {
          stage,
          timestamp: new Date().toISOString(),
          duration,
          ...metadata,
        },
      });
    },
    [tenantId, missionId, getStageDuration]
  );

  const contextValue = useMemo(
    () => ({
      stages,
      currentStage,
      markStageStarted,
      markStageCompleted,
      markStageFailed,
      getNextStage,
      getStageDuration,
    }),
    [
      stages,
      currentStage,
      markStageStarted,
      markStageCompleted,
      markStageFailed,
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
