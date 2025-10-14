"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

const SEGMENT_ORDER = ['objectives', 'safeguards', 'plays', 'datasets'] as const;

const SEGMENT_LABELS: Record<(typeof SEGMENT_ORDER)[number], string> = {
  objectives: 'Objectives & KPIs',
  safeguards: 'Safeguards',
  plays: 'Planner Plays',
  datasets: 'Datasets & Evidence',
};

const STATUS_COLOR_CLASS: Record<'pass' | 'warn' | 'fail', string> = {
  pass: 'text-emerald-400',
  warn: 'text-amber-300',
  fail: 'text-red-400',
};

const RADIAL_BACKGROUND_CLASS = 'text-slate-700/50';

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

function generateBaselineGaps(readiness: number, toolkitsCount: number, hasArtifacts: boolean): GapItem[] {
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
  const coverageTelemetrySignatureRef = useRef<string | null>(null);

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
  const normalizedCategoryMap = useMemo(() => normalizeCategories(gatedCategories), [gatedCategories]);
  const radialSegments = useMemo(
    () =>
      SEGMENT_ORDER.map((id) => {
        const category = normalizedCategoryMap[id] ?? createPlaceholderCategory(id);
        const coverage = Math.round(clampPercentage(category.coverage, 0));
        const status: 'pass' | 'warn' | 'fail' =
          category.status ?? resolveCategoryStatus(coverage, category.threshold ?? READINESS_THRESHOLD);

        return {
          id,
          label: category.label ?? SEGMENT_LABELS[id],
          coverage,
          status,
        };
      }),
    [normalizedCategoryMap],
  );
  const canProceed = preview?.canProceed ?? gate.canProceed;
  const toolkitCount = preview?.toolkits?.length ?? 0;

  useEffect(() => {
    if (!tenantId) {
      return;
    }

    const bucketCounts = gatedCategories.reduce(
      (acc, category) => {
        if (category.status === 'pass' || category.status === 'warn' || category.status === 'fail') {
          acc[category.status] += 1;
        }
        return acc;
      },
      { pass: 0, warn: 0, fail: 0 } as Record<'pass' | 'warn' | 'fail', number>,
    );

    const signature = JSON.stringify({
      readiness,
      threshold: gate.threshold,
      canProceed,
      categories: gatedCategories.map((category) => [category.id, Math.round(category.coverage), category.status]),
    });

    if (coverageTelemetrySignatureRef.current === signature) {
      return;
    }

    coverageTelemetrySignatureRef.current = signature;

    void sendTelemetryEvent(tenantId, {
      eventName: 'inspection_coverage_viewed',
      missionId: missionId ?? undefined,
      eventData: {
        readiness,
        gate_threshold: gate.threshold,
        canProceed,
        selectedToolkitsCount,
        hasArtifacts,
        bucketCounts,
        categories: gatedCategories.map((category) => ({
          id: category.id,
          coverage: category.coverage,
          threshold: category.threshold,
          status: category.status,
        })),
        gate,
        toolkitCount,
      },
    });
  }, [
    gatedCategories,
    gate,
    canProceed,
    readiness,
    tenantId,
    missionId,
    selectedToolkitsCount,
    hasArtifacts,
    toolkitCount,
  ]);

  const gapMessageByCategory: Record<string, string> = {
    objectives: 'Accept the generated objective, audience, and KPI chips to lock the mission brief.',
    safeguards: 'Approve at least one safeguard hint to satisfy compliance requirements.',
    plays: 'Generate a planner dry-run and pin a play before advancing.',
    datasets: 'Attach datasets or evidence artifacts so validators have coverage.',
    toolkits: 'Add at least one mission toolkit before planning.',
    evidence: 'Run a dry-run to generate evidence before planning.',
  };

  const gaps = useMemo(() => {
    if (gatedCategories.length === 0) {
      return generateBaselineGaps(readiness, selectedToolkitsCount, hasArtifacts);
    }

    return gatedCategories
      .filter((category) => category.status !== 'pass')
      .map((category) => ({
        id: `category-${category.id}`,
        message:
          gapMessageByCategory[category.id] ??
          category.description ??
          'Address outstanding inspection feedback before continuing.',
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

  const readinessTextColor = getReadinessTextColor(readiness);
  const summaryMessage =
    preview?.summary ?? (canProceed ? 'Inspection readiness meets threshold.' : 'Inspection readiness below threshold.');
  const gateReason = gate.reason ?? (canProceed ? 'Inspection readiness meets threshold.' : 'Coverage below inspection requirement.');
  const findingReference = preview?.findingId ?? null;
  const findingTimestamp = preview?.findingCreatedAt ?? null;
  const findingTooltip = findingReference ? buildFindingTooltip(findingReference, findingTimestamp) : null;
  const findingDisplayId = findingReference ? formatFindingId(findingReference) : null;

  return (
    <section className="border-b border-white/10 px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-white">Coverage & Readiness</h2>
          <p className="mt-1 text-xs text-slate-400">
            Verify mission readiness, safeguard coverage, and evidence before moving to planning.
          </p>
        </header>

        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_1fr]">
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex items-center justify-center">
                <SegmentedRadialMeter segments={radialSegments} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Readiness</span>
                  <span className={`text-2xl font-semibold ${readinessTextColor}`}>{readiness}%</span>
                  <span className="text-[10px] text-slate-500">Threshold {READINESS_THRESHOLD}%</span>
                </div>
              </div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Segments: objectives · safeguards · plays · datasets</p>
              {findingReference && findingDisplayId && (
                <div className="text-xs text-slate-400">
                  <span
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200"
                    title={findingTooltip ?? undefined}
                    aria-label={findingTooltip ?? undefined}
                  >
                    <span className="h-2 w-2 rounded-full bg-violet-400" aria-hidden="true" />
                    {`Finding ${findingDisplayId}`}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {errorMessage && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {errorMessage}
                </div>
              )}

              {summaryMessage && (
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    canProceed
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  }`}
                >
                  {summaryMessage}
                </div>
              )}

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

              <div className="space-y-2">
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
  const categoriesWithGate = applyGateToCategories(categories, gate);

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
      ? 'Inspection readiness meets threshold.'
      : 'Inspection readiness below threshold.';

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
  const objectivesCoverage = clampPercentage(readiness);
  const safeguardsCoverage = clampPercentage(
    selectedToolkitsCount > 0 ? Math.min(90, 60 + selectedToolkitsCount * 10) : 30,
  );
  const playsCoverage = clampPercentage(
    selectedToolkitsCount >= 2 ? 55 : selectedToolkitsCount > 0 ? 35 : 15,
  );
  const datasetsCoverage = clampPercentage(hasArtifacts ? 60 : 20);

  return [
    createFallbackCategory('objectives', objectivesCoverage, READINESS_THRESHOLD, 'Accept mission brief chips to reach 100%.'),
    createFallbackCategory('safeguards', safeguardsCoverage, 80, 'Approve at least one safeguard hint before proceeding.'),
    createFallbackCategory('plays', playsCoverage, 80, 'Generate and pin a planner play before continuing.'),
    createFallbackCategory('datasets', datasetsCoverage, 70, 'Attach datasets or evidence artifacts before planning.'),
  ];
}

function createFallbackCategory(
  id: (typeof SEGMENT_ORDER)[number],
  coverage: number,
  threshold: number,
  description: string,
): InspectionCategory {
  const resolvedCoverage = clampPercentage(coverage, 0);
  return {
    id,
    label: SEGMENT_LABELS[id],
    coverage: resolvedCoverage,
    threshold,
    status: resolveCategoryStatus(resolvedCoverage, threshold),
    description,
  };
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
  let id = rawId;
  if (rawId === 'artifacts' || rawId === 'evidence') {
    id = 'datasets';
  } else if (rawId === 'toolkits') {
    id = 'plays';
  } else if (rawId === 'readiness') {
    id = 'objectives';
  }

  const label = typeof category.label === 'string' && category.label.trim() ? category.label.trim() : SEGMENT_LABELS[id as (typeof SEGMENT_ORDER)[number]] ?? id;
  const coverage = clampPercentage(category.coverage, 0);
  const threshold = clampPercentage(category.threshold, id === 'datasets' ? 70 : id === 'objectives' ? READINESS_THRESHOLD : 80);
  const status = resolveCategoryStatus(coverage, threshold);
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
    if (!gate.canProceed && (category.id === 'plays' || category.id === 'datasets')) {
      return {
        ...category,
        status: category.status === 'pass' ? 'fail' : category.status,
        description:
          category.description ??
          (category.id === 'plays'
            ? 'Generate and pin a planner play before continuing.'
            : 'Attach datasets or evidence artifacts before planning.'),
      };
    }

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

type RadialSegment = {
  id: string;
  label: string;
  coverage: number;
  status: 'pass' | 'warn' | 'fail';
};

function SegmentedRadialMeter({ segments }: { segments: RadialSegment[] }) {
  if (!segments.length) {
    return <svg viewBox="0 0 128 128" className="h-40 w-40 text-slate-700/40"></svg>;
  }

  const center = 64;
  const radius = 54;
  const strokeWidth = 10;
  const sweep = 360 / segments.length;
  const gap = 8;

  return (
    <svg viewBox="0 0 128 128" className="h-40 w-40">
      {segments.map((segment, index) => {
        const start = -90 + index * sweep + gap / 2;
        const end = start + sweep - gap;
        const clampedCoverage = Math.max(0, Math.min(100, segment.coverage));
        const backgroundPath = describeArc(center, center, radius, start, end);
        const coverageEnd = start + ((end - start) * clampedCoverage) / 100;
        const coveragePath =
          clampedCoverage > 0
            ? describeArc(center, center, radius, start, coverageEnd)
            : null;

        return (
          <g key={segment.id}>
            <path
              d={backgroundPath}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className={RADIAL_BACKGROUND_CLASS}
              stroke="currentColor"
            />
            {coveragePath && (
              <path
                d={coveragePath}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                className={STATUS_COLOR_CLASS[segment.status]}
                stroke="currentColor"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function normalizeCategories(categories: InspectionCategory[]): Record<string, InspectionCategory> {
  const map = new Map<string, InspectionCategory>();

  for (const category of categories) {
    if (!map.has(category.id)) {
      map.set(category.id, category);
    }
  }

  if (!map.has('objectives')) {
    const fallback = map.get('readiness');
    if (fallback) {
      map.set('objectives', { ...fallback, id: 'objectives', label: SEGMENT_LABELS.objectives });
    }
  }

  if (!map.has('safeguards')) {
    const fallback = map.get('toolkits');
    if (fallback) {
      map.set('safeguards', { ...fallback, id: 'safeguards', label: SEGMENT_LABELS.safeguards });
    }
  }

  if (!map.has('plays')) {
    const fallback = map.get('toolkits') ?? map.get('readiness');
    if (fallback) {
      map.set('plays', { ...fallback, id: 'plays', label: SEGMENT_LABELS.plays });
    }
  }

  if (!map.has('datasets')) {
    const fallback = map.get('evidence') ?? map.get('artifacts');
    if (fallback) {
      map.set('datasets', { ...fallback, id: 'datasets', label: SEGMENT_LABELS.datasets });
    }
  }

  return Object.fromEntries(map);
}

function createPlaceholderCategory(id: (typeof SEGMENT_ORDER)[number]): InspectionCategory {
  const threshold = id === 'datasets' ? 70 : id === 'objectives' ? READINESS_THRESHOLD : 80;
  return {
    id,
    label: SEGMENT_LABELS[id],
    coverage: 0,
    threshold,
    status: 'fail',
    description: undefined,
  };
}

function resolveCategoryStatus(coverage: number, threshold: number): 'pass' | 'warn' | 'fail' {
  if (coverage >= threshold) {
    return 'pass';
  }
  if (coverage >= threshold * 0.6) {
    return 'warn';
  }
  return 'fail';
}

function formatFindingId(findingId: string): string {
  if (findingId.length <= 8) {
    return findingId;
  }
  return `${findingId.slice(0, 6)}…${findingId.slice(-4)}`;
}

function buildFindingTooltip(findingId: string, timestamp: string | null): string {
  if (!timestamp) {
    return `Inspection finding ${findingId}`;
  }
  const formatted = formatTimestamp(timestamp);
  return `Inspection finding ${findingId} • ${formatted}`;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}
