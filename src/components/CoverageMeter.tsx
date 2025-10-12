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

type InspectionCategory = {
  id: string;
  label: string;
  coverage: number;
  threshold: number;
  status: 'pass' | 'warn' | 'fail';
  description?: string;
};

type GateSummary = {
  threshold: number;
  canProceed: boolean;
  reason: string;
  overrideAvailable: boolean;
};

type PreviewState = {
  readiness: number;
  canProceed: boolean;
  categories: InspectionCategory[];
  gate: GateSummary;
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

  const fallbackCategories = useMemo(
    () =>
      buildFallbackCategories({
        selectedToolkitsCount,
        hasArtifacts,
        readiness: baselineReadiness,
      }),
    [baselineReadiness, hasArtifacts, selectedToolkitsCount],
  );

  const fallbackGate = useMemo(
    () => buildGateSummaryFromCategories(fallbackCategories, baselineReadiness, READINESS_THRESHOLD),
    [baselineReadiness, fallbackCategories],
  );

  const readiness = preview?.readiness ?? baselineReadiness;
  const categories = preview?.categories ?? fallbackCategories;
  const gate = preview?.gate ?? fallbackGate;
  const gatedCategories = useMemo(() => applyGateToCategories(categories, gate), [categories, gate]);
  const canProceed = preview?.canProceed ?? gate.canProceed;

  const gaps = useMemo(() => {
    if (gatedCategories.length === 0) {
      return generateGaps(readiness, selectedToolkitsCount, hasArtifacts);
    }

    return gatedCategories
      .filter((category) => category.status !== 'pass')
      .map((category) => ({
        id: `category-${category.id}`,
        message:
          category.id === 'toolkits'
            ? 'Add at least one mission toolkit before planning.'
            : category.id === 'evidence'
              ? category.description ?? 'Run a dry-run to generate evidence before planning.'
              : category.description ?? 'Address outstanding inspection feedback before continuing.',
        severity: category.status === 'fail' ? 'error' : 'warning',
      }));
  }, [gatedCategories, hasArtifacts, readiness, selectedToolkitsCount]);

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
        threshold: READINESS_THRESHOLD,
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
          categories: normalized.categories,
          gate: normalized.gate,
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
            categories: normalized.categories,
            gate: normalized.gate,
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
  const summaryMessage = preview?.summary ?? (canProceed ? 'Coverage verified' : 'Insufficient toolkit coverage');
  const gateReason = canProceed ? 'Coverage verified' : 'Insufficient toolkit coverage';

  return (
    <section className="border-b border-white/10 px-6 py-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-white">Coverage & Readiness</h2>
          <p className="text-xs text-slate-400 mt-1">
            Verify coverage and data readiness before planning execution
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

          {summaryMessage && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                canProceed
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              }`}
            >
              {summaryMessage}
            </div>
          )}

          {gatedCategories.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-200">Inspection Categories</h3>
              <ul className="space-y-2">
                {gatedCategories.map((category) => (
                  <li
                    key={category.id}
                    className={`rounded-lg border px-3 py-2 text-sm ${getCategoryClasses(category.status)}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">{category.label}</p>
                        {category.description && (
                          <p className="mt-1 text-xs text-slate-200/80">{category.description}</p>
                        )}
                      </div>
                      <div className="text-right text-xs text-slate-200/80">
                        <p>{Math.round(category.coverage)}% • target {Math.round(category.threshold)}%</p>
                        <p className="mt-0.5 uppercase tracking-wide">
                          {category.status === 'pass'
                            ? 'PASS'
                            : category.status === 'warn'
                              ? 'WARN'
                              : 'FAIL'}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
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
                  {(() => {
                    const count = preview?.toolkits ? preview.toolkits.length : selectedToolkitsCount;
                    return count > 0 ? count : 'No toolkits selected';
                  })()}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2">
                <dt className="text-slate-400">Prior mission artifacts</dt>
                <dd className="font-semibold text-white">{hasArtifacts ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </div>

          <footer className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">{gateReason}</p>
            <div className="flex items-center gap-2">
              {!canProceed && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-violet-400/40 bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/30"
                >
                  Request override
                </button>
              )}
              <button
                type="button"
                onClick={handleRecordInspection}
                disabled={isRecording || !missionId || selectedToolkitsCount === 0}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  canProceed
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-60'
                }`}
              >
                {isRecording ? 'Recording...' : 'Record Inspection'}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </section>
  );
}

function normalizePreviewResponse(
  payload: PreviewState | Record<string, unknown> | null,
  context: {
    baselineReadiness: number;
    selectedToolkitsCount: number;
    hasArtifacts: boolean;
    threshold: number;
  },
): PreviewState {
  const { baselineReadiness, selectedToolkitsCount, hasArtifacts, threshold } = context;

  const candidate = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const responseReadiness = (() => {
    const value = (candidate as PreviewState).readiness;
    return typeof value === 'number' && Number.isFinite(value) ? value : baselineReadiness;
  })();

  const toolkits = Array.isArray((candidate as PreviewState).toolkits)
    ? ((candidate as PreviewState).toolkits as PreviewState['toolkits'])
    : [];

  const rawCategories = Array.isArray((candidate as PreviewState).categories)
    ? ((candidate as Record<string, unknown>).categories as Array<Record<string, unknown>>)
    : [];

  const fallbackFromContext = buildFallbackCategories({
    selectedToolkitsCount,
    hasArtifacts,
    readiness: responseReadiness,
  });

  const categories = rawCategories.length
    ? rawCategories
        .map((category, index) => sanitizeCategory(category, index))
        .filter((category): category is InspectionCategory => category !== null)
    : fallbackFromContext;

  const gate = sanitizeGate((candidate as Record<string, unknown>).gate, categories, responseReadiness);
  const effectiveCategories = gate.canProceed ? categories : fallbackFromContext;
  const categoriesWithGate = applyGateToCategories(effectiveCategories, gate);

  const canProceed = (() => {
    const explicit = (candidate as PreviewState).canProceed;
    if (typeof explicit === 'boolean') {
      return explicit;
    }
    return gate.canProceed;
  })();

  const summary = typeof (candidate as PreviewState).summary === 'string'
    ? ((candidate as PreviewState).summary as string)
    : responseReadiness >= threshold
      ? 'Coverage verified'
      : 'Insufficient toolkit coverage';

  return {
    readiness: responseReadiness,
    canProceed,
    categories: categoriesWithGate,
    gate,
    summary,
    toolkits,
    findingId: typeof (candidate as PreviewState).findingId === 'string' ? (candidate as PreviewState).findingId : undefined,
    findingCreatedAt:
      typeof (candidate as PreviewState).findingCreatedAt === 'string'
        ? (candidate as PreviewState).findingCreatedAt
        : undefined,
  };
}

function buildFallbackCategories(options: {
  selectedToolkitsCount: number;
  hasArtifacts: boolean;
  readiness: number;
}): InspectionCategory[] {
  const { selectedToolkitsCount, hasArtifacts, readiness } = options;

  const toolkitCoverage = clampPercentage(
    selectedToolkitsCount >= 3 ? 100 : selectedToolkitsCount === 2 ? 88 : selectedToolkitsCount === 1 ? 72 : 25,
  );
  const evidenceCoverage = clampPercentage(hasArtifacts ? 80 : 30);
  const readinessCoverage = clampPercentage(readiness);

  return [
    {
      id: 'toolkits',
      label: 'Toolkit coverage',
      coverage: toolkitCoverage,
      threshold: READINESS_THRESHOLD,
      status: resolveStatus(toolkitCoverage, READINESS_THRESHOLD),
      description:
        selectedToolkitsCount > 0
          ? 'Recommended toolkit mix locked in.'
          : 'Select at least one mission toolkit',
    },
    {
      id: 'evidence',
      label: 'Evidence history',
      coverage: evidenceCoverage,
      threshold: 70,
      status: resolveStatus(evidenceCoverage, 70),
      description: hasArtifacts
        ? 'Previous artifacts available for validator review.'
        : 'Run a dry-run to generate evidence before planning.',
    },
    {
      id: 'readiness',
      label: 'Overall readiness',
      coverage: readinessCoverage,
      threshold: READINESS_THRESHOLD,
      status: resolveStatus(readinessCoverage, READINESS_THRESHOLD),
    },
  ];
}

function buildGateSummaryFromCategories(
  categories: InspectionCategory[],
  readiness: number,
  threshold: number,
): GateSummary {
  const canProceed = readiness >= threshold;
  const reason = canProceed
    ? 'Inspection readiness meets threshold.'
    : 'Coverage below inspection requirement.';

  return {
    threshold,
    canProceed,
    reason,
    overrideAvailable: !canProceed,
  };
}

function sanitizeCategory(
  category: Record<string, unknown>,
  index: number,
): InspectionCategory | null {
  const rawId = typeof category.id === 'string' && category.id.trim() ? category.id.trim() : `category-${index}`;
  const id = rawId === 'artifacts' ? 'evidence' : rawId;
  const label = typeof category.label === 'string' && category.label.trim() ? category.label.trim() : id;
  const coverage = clampPercentage(category.coverage, 0);
  const threshold = clampPercentage(category.threshold, READINESS_THRESHOLD);
  const status = resolveStatus(coverage, threshold);
  const description = typeof category.description === 'string' ? category.description : undefined;

  return {
    id,
    label,
    coverage,
    threshold,
    status,
    description,
  };
}

function sanitizeGate(
  gate: unknown,
  categories: InspectionCategory[],
  readiness: number,
): GateSummary {
  if (gate && typeof gate === 'object') {
    const cast = gate as Record<string, unknown>;
    const threshold = clampPercentage(cast.threshold, READINESS_THRESHOLD);
    const fallbackCanProceed = readiness >= threshold;
    const canProceed = typeof cast.canProceed === 'boolean' ? cast.canProceed : fallbackCanProceed;
    const reason = canProceed
      ? 'Inspection readiness meets threshold.'
      : 'Coverage below inspection requirement.';
    const overrideAvailable = !canProceed;

    return {
      threshold,
      canProceed,
      reason,
      overrideAvailable,
    };
  }

  return buildGateSummaryFromCategories(categories, readiness, READINESS_THRESHOLD);
}

function resolveStatus(coverage: number, threshold: number): InspectionCategory['status'] {
  if (coverage >= threshold) {
    return 'pass';
  }
  if (coverage >= threshold * 0.6) {
    return 'warn';
  }
  return 'fail';
}

function clampPercentage(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(100, numeric));
  }
  return fallback;
}

function getCategoryClasses(status: InspectionCategory['status']): string {
  if (status === 'pass') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
  }
  if (status === 'warn') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  }
  return 'border-red-500/30 bg-red-500/10 text-red-100';
}

function applyGateToCategories(
  categories: InspectionCategory[],
  gate: GateSummary,
): InspectionCategory[] {
  return categories.map((category) => {
    if (!gate.canProceed && category.id === 'toolkits') {
      return {
        ...category,
        status: category.status === 'pass' ? 'fail' : category.status,
        description: 'Select at least one mission toolkit',
      };
    }

    if (!gate.canProceed && category.id === 'evidence') {
      return {
        ...category,
        status: category.status === 'pass' ? 'fail' : category.status,
        description: category.description ?? 'Run a dry-run to generate evidence before planning.',
      };
    }

    return category;
  });
}
