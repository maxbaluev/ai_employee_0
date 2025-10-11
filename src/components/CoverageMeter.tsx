"use client";

import { useCallback, useMemo, useState } from 'react';

import { sendTelemetryEvent } from '@/lib/telemetry/client';

type CoverageMeterProps = {
  tenantId: string;
  missionId: string | null;
  selectedToolkitsCount: number;
  hasArtifacts: boolean;
  onComplete: (preview: Record<string, unknown>) => void;
};

type GapItem = {
  id: string;
  message: string;
  severity: 'warning' | 'error';
};

function calculateReadiness(toolkitsCount: number, hasArtifacts: boolean): number {
  let readiness = 60; // Base readiness

  // Add 20% if at least one toolkit is selected
  if (toolkitsCount > 0) {
    readiness += 20;
  }

  // Add 20% if mission has artifacts (evidence of prior work)
  if (hasArtifacts) {
    readiness += 20;
  }

  // Cap between 0-100
  return Math.max(0, Math.min(100, readiness));
}

const READINESS_THRESHOLD = 85;
const INSPECTION_FINDING_TYPE = 'coverage_preview';

function generateGaps(readiness: number, toolkitsCount: number, hasArtifacts: boolean): GapItem[] {
  const gaps: GapItem[] = [];

  if (toolkitsCount === 0) {
    gaps.push({
      id: 'no-toolkits',
      message: 'No toolkits selected. Select at least one toolkit to improve readiness.',
      severity: 'error',
    });
  }

  if (!hasArtifacts) {
    gaps.push({
      id: 'no-artifacts',
      message: 'No artifacts present. Prior mission artifacts can improve confidence.',
      severity: 'warning',
    });
  }

  if (readiness < 85 && gaps.length === 0) {
    gaps.push({
      id: 'low-readiness',
      message: 'Readiness below threshold. Consider adding more context or toolkits.',
      severity: 'warning',
    });
  }

  return gaps;
}

function getReadinessColor(readiness: number): string {
  if (readiness >= 85) {
    return 'bg-emerald-500';
  }
  if (readiness >= 70) {
    return 'bg-amber-500';
  }
  return 'bg-red-500';
}

function getReadinessTextColor(readiness: number): string {
  if (readiness >= 85) {
    return 'text-emerald-300';
  }
  if (readiness >= 70) {
    return 'text-amber-300';
  }
  return 'text-red-300';
}

export function CoverageMeter({
  tenantId,
  missionId,
  selectedToolkitsCount,
  hasArtifacts,
  onComplete,
}: CoverageMeterProps) {
  const [isRecording, setIsRecording] = useState(false);

  const readiness = useMemo(
    () => calculateReadiness(selectedToolkitsCount, hasArtifacts),
    [selectedToolkitsCount, hasArtifacts]
  );

  const gaps = useMemo(
    () => generateGaps(readiness, selectedToolkitsCount, hasArtifacts),
    [readiness, selectedToolkitsCount, hasArtifacts]
  );

  const handleRecordInspection = useCallback(async () => {
    if (isRecording) {
      return;
    }

    setIsRecording(true);

    const requestBody = {
      missionId: missionId ?? null,
      findingType: INSPECTION_FINDING_TYPE,
      payload: {
        selectedToolkitsCount,
        hasArtifacts,
      },
      readiness,
    };

    try {
      const response = await fetch('/api/inspect/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const previewPayload = (await response.json().catch(() => null)) as
        | Record<string, unknown>
        | null;
      const preview =
        previewPayload && typeof previewPayload === 'object' && !Array.isArray(previewPayload)
          ? previewPayload
          : {};
      const responseReadiness =
        typeof preview.readiness === 'number' ? (preview.readiness as number) : readiness;
      const canProceed = responseReadiness >= READINESS_THRESHOLD;

      await sendTelemetryEvent(tenantId, {
        eventName: 'inspection_preview_rendered',
        missionId: missionId ?? undefined,
        eventData: {
          readiness: responseReadiness,
          selectedToolkitsCount,
          hasArtifacts,
          canProceed,
        },
      });

      if (!response.ok) {
        const errorMessage =
          typeof preview?.error === 'string'
            ? (preview.error as string)
            : 'Failed to fetch inspection preview';
        throw new Error(errorMessage);
      }

      if (canProceed) {
        await sendTelemetryEvent(tenantId, {
          eventName: 'coverage_ready',
          missionId: missionId ?? undefined,
          eventData: {
            readiness: responseReadiness,
            selectedToolkitsCount,
            hasArtifacts,
          },
        });

        onComplete({
          ...preview,
          readiness: responseReadiness,
          canProceed,
        });
      }
    } catch (error) {
      console.error('Failed to record inspection preview', error);
    } finally {
      setIsRecording(false);
    }
  }, [
    hasArtifacts,
    isRecording,
    missionId,
    onComplete,
    readiness,
    selectedToolkitsCount,
    tenantId,
  ]);

  const readinessColor = getReadinessColor(readiness);
  const readinessTextColor = getReadinessTextColor(readiness);
  const canProceed = readiness >= READINESS_THRESHOLD;

  return (
    <section className="border-b border-white/10 px-6 py-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-white">Coverage & Readiness</h2>
          <p className="text-xs text-slate-400 mt-1">
            Verify toolkit coverage and data readiness before planning execution
          </p>
        </header>

        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-200">Readiness Score</span>
              <span className={`text-2xl font-bold ${readinessTextColor}`}>
                {readiness}%
              </span>
            </div>

            <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-700/50">
              <div
                className={`h-full transition-all duration-500 ease-out ${readinessColor}`}
                style={{ width: `${readiness}%` }}
                role="progressbar"
                aria-valuenow={readiness}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Readiness score"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Minimum threshold: 85%</span>
              {readiness >= 85 && (
                <span className="text-emerald-300">✓ Ready to proceed</span>
              )}
            </div>
          </div>

          {gaps.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-200">Coverage Gaps</h3>
              <ul className="space-y-2">
                {gaps.map((gap) => (
                  <li
                    key={gap.id}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                      gap.severity === 'error'
                        ? 'border-red-500/40 bg-red-500/10 text-red-200'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                    }`}
                  >
                    <span className="mt-0.5 text-xs" aria-hidden="true">
                      {gap.severity === 'error' ? '●' : '▲'}
                    </span>
                    <span>{gap.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-medium text-slate-200">Readiness Factors</h3>
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2">
                <dt className="text-slate-400">Selected toolkits</dt>
                <dd className="font-semibold text-white">{selectedToolkitsCount}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2">
                <dt className="text-slate-400">Prior artifacts</dt>
                <dd className="font-semibold text-white">{hasArtifacts ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </div>

          <footer className="flex items-center justify-between border-t border-white/10 pt-4">
            <p className="text-xs text-slate-400">
              {canProceed
                ? 'Coverage meets minimum requirements'
                : 'Improve coverage to enable inspection recording'}
            </p>
            <button
              type="button"
              onClick={handleRecordInspection}
              disabled={!canProceed || isRecording}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                canProceed
                  ? 'bg-violet-500 text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60'
                  : 'cursor-not-allowed bg-slate-600 text-slate-400 opacity-50'
              }`}
            >
              {isRecording ? 'Recording...' : 'Record Inspection'}
            </button>
          </footer>
        </div>
      </div>
    </section>
  );
}
