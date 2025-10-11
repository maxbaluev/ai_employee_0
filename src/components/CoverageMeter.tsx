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

type PreviewState = {
  readiness: number;
  canProceed: boolean;
  summary?: string;
  toolkits?: Array<{
    slug: string;
    name: string;
    sampleCount?: number;
    sampleRows?: string[];
  }>;
  findingId?: string;
  findingCreatedAt?: string;
};

export function CoverageMeter({
  tenantId,
  missionId,
  selectedToolkitsCount,
  hasArtifacts,
  onComplete,
}: CoverageMeterProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const baselineReadiness = useMemo(
    () => calculateReadiness(selectedToolkitsCount, hasArtifacts),
    [selectedToolkitsCount, hasArtifacts],
  );

  const readiness = preview?.readiness ?? baselineReadiness;
  const gaps = useMemo(
    () => generateGaps(readiness, selectedToolkitsCount, hasArtifacts),
    [readiness, selectedToolkitsCount, hasArtifacts],
  );

  const handleRecordInspection = useCallback(async () => {
    if (isRecording) {
      return;
    }

    if (!missionId) {
      setErrorMessage('Accept the mission intake before recording inspection.');
      return;
    }

    setIsRecording(true);
    setErrorMessage(null);

    const requestBody = {
      missionId,
      tenantId,
      findingType: INSPECTION_FINDING_TYPE,
      payload: {
        selectedToolkitsCount,
        hasArtifacts,
      },
    };

    try {
      const response = await fetch('/api/inspect/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const responsePayload = (await response.json().catch(() => null)) as
        | PreviewState
        | Record<string, unknown>
        | null;

      const normalized: PreviewState = normalizePreviewResponse(responsePayload, {
        baselineReadiness,
        selectedToolkitsCount,
        hasArtifacts,
      });
      setPreview(normalized);

      const canProceed = normalized.canProceed;
      const responseReadiness = normalized.readiness;

      await sendTelemetryEvent(tenantId, {
        eventName: 'inspection_preview_rendered',
        missionId,
        eventData: {
          readiness: responseReadiness,
          selectedToolkitsCount,
          hasArtifacts,
          canProceed,
          toolkit_count: normalized.toolkits?.length ?? 0,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch inspection preview');
      }

      if (canProceed) {
        await sendTelemetryEvent(tenantId, {
          eventName: 'coverage_ready',
          missionId,
          eventData: {
            readiness: responseReadiness,
            selectedToolkitsCount,
            hasArtifacts,
            finding_id: normalized.findingId,
          },
        });

        onComplete({
          ...normalized,
          readiness: responseReadiness,
          canProceed,
        });
      }
    } catch (error) {
      console.error('Failed to record inspection preview', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to record inspection preview',
      );
    } finally {
      setIsRecording(false);
    }
  }, [
    baselineReadiness,
    hasArtifacts,
    isRecording,
    missionId,
    onComplete,
    selectedToolkitsCount,
    tenantId,
  ]);

  const readinessColor = getReadinessColor(readiness);
  const readinessTextColor = getReadinessTextColor(readiness);
  const canProceed = preview?.canProceed ?? readiness >= READINESS_THRESHOLD;

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

          {errorMessage && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {errorMessage}
            </div>
          )}

          {preview?.summary && (
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {preview.summary}
            </div>
          )}

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
                <dd className="font-semibold text-white">
                  {preview?.toolkits ? preview.toolkits.length : selectedToolkitsCount}
                </dd>
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
              disabled={isRecording || !missionId || selectedToolkitsCount === 0}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                canProceed
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60'
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

function normalizePreviewResponse(
  payload: PreviewState | Record<string, unknown> | null,
  context: { baselineReadiness: number; selectedToolkitsCount: number; hasArtifacts: boolean },
): PreviewState {
  const { baselineReadiness, selectedToolkitsCount, hasArtifacts } = context;

  const candidate = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const responseReadiness = (() => {
    const value = (candidate as PreviewState).readiness;
    return typeof value === 'number' && Number.isFinite(value) ? value : baselineReadiness;
  })();

  const toolkits = Array.isArray((candidate as PreviewState).toolkits)
    ? ((candidate as PreviewState).toolkits as PreviewState['toolkits'])
    : [];

  const canProceed = (() => {
    const explicit = (candidate as PreviewState).canProceed;
    if (typeof explicit === 'boolean') {
      return explicit;
    }
    return responseReadiness >= READINESS_THRESHOLD;
  })();

  const summary = typeof (candidate as PreviewState).summary === 'string'
    ? ((candidate as PreviewState).summary as string)
    : toolkits.length
      ? `${toolkits.length} toolkit${toolkits.length === 1 ? '' : 's'} inspected`
      : hasArtifacts || selectedToolkitsCount > 0
        ? 'Inspection preview recorded.'
        : 'No toolkit selections available.';

  return {
    readiness: responseReadiness,
    canProceed,
    summary,
    toolkits,
    findingId: typeof (candidate as PreviewState).findingId === 'string' ? (candidate as PreviewState).findingId : undefined,
    findingCreatedAt:
      typeof (candidate as PreviewState).findingCreatedAt === 'string'
        ? (candidate as PreviewState).findingCreatedAt
        : undefined,
  };
}
