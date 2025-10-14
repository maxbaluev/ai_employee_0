"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import { sendTelemetryEvent } from '@/lib/telemetry/client';

export type InspectionFinding = {
  id: string;
  category: 'coverage' | 'safeguard' | 'risk' | 'data_quality';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  recommendation?: string;
  affectedToolkits?: string[];
  affectedObjectives?: string[];
  status?: 'new' | 'acknowledged' | 'resolved' | 'deferred';
  createdAt?: string;
};

export type InspectionSummaryListProps = {
  tenantId: string;
  missionId: string | null;
  findings: InspectionFinding[];
  onAcceptGap?: (findingId: string) => void | Promise<void>;
  onRegenerate?: (findingId: string) => void | Promise<void>;
  onDismiss?: (findingId: string) => void | Promise<void>;
};

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    icon: '⛔',
    colorClass: 'border-red-500/40 bg-red-500/10 text-red-200',
    iconColorClass: 'text-red-400',
  },
  high: {
    label: 'High',
    icon: '⚠️',
    colorClass: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
    iconColorClass: 'text-orange-400',
  },
  medium: {
    label: 'Medium',
    icon: '⚡',
    colorClass: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    iconColorClass: 'text-amber-400',
  },
  low: {
    label: 'Low',
    icon: 'ℹ️',
    colorClass: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
    iconColorClass: 'text-blue-400',
  },
} as const;

const CATEGORY_CONFIG = {
  coverage: {
    label: 'Coverage Gap',
    description: 'Missing or incomplete data coverage for mission objectives',
  },
  safeguard: {
    label: 'Safeguard Alert',
    description: 'Potential policy or compliance concern',
  },
  risk: {
    label: 'Risk Signal',
    description: 'Elevated risk detected in planned execution',
  },
  data_quality: {
    label: 'Data Quality',
    description: 'Data freshness or accuracy concern',
  },
} as const;

export function InspectionSummaryList({
  tenantId,
  missionId,
  findings,
  onAcceptGap,
  onRegenerate,
  onDismiss,
}: InspectionSummaryListProps) {
  const [expandedFindingIds, setExpandedFindingIds] = useState<Set<string>>(new Set());
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const groupedFindings = useMemo(() => {
    const groups: Record<InspectionFinding['category'], InspectionFinding[]> = {
      coverage: [],
      safeguard: [],
      risk: [],
      data_quality: [],
    };

    for (const finding of findings) {
      groups[finding.category].push(finding);
    }

    // Sort each group by severity (critical → low)
    const severityOrder = ['critical', 'high', 'medium', 'low'] as const;
    for (const category of Object.keys(groups) as Array<keyof typeof groups>) {
      groups[category].sort((a, b) => {
        return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
      });
    }

    return groups;
  }, [findings]);

  const categoriesWithFindings = useMemo(() => {
    return (Object.keys(groupedFindings) as Array<keyof typeof groupedFindings>).filter(
      (category) => groupedFindings[category].length > 0,
    );
  }, [groupedFindings]);

  useEffect(() => {
    if (!tenantId || findings.length === 0) {
      return;
    }

    const severityCounts = findings.reduce(
      (acc, finding) => {
        acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
        return acc;
      },
      {} as Record<InspectionFinding['severity'], number>,
    );

    const categoryCounts = findings.reduce(
      (acc, finding) => {
        acc[finding.category] = (acc[finding.category] ?? 0) + 1;
        return acc;
      },
      {} as Record<InspectionFinding['category'], number>,
    );

    void sendTelemetryEvent(tenantId, {
      eventName: 'inspection_summary_viewed',
      missionId: missionId ?? undefined,
      eventData: {
        finding_count: findings.length,
        severity_counts: severityCounts,
        category_counts: categoryCounts,
      },
    });
  }, [findings, missionId, tenantId]);

  const toggleExpanded = useCallback((findingId: string) => {
    setExpandedFindingIds((prev) => {
      const next = new Set(prev);
      if (next.has(findingId)) {
        next.delete(findingId);
      } else {
        next.add(findingId);
      }
      return next;
    });
  }, []);

  const handleAcceptGap = useCallback(
    async (finding: InspectionFinding) => {
      if (actionInProgress || !onAcceptGap) {
        return;
      }

      setActionInProgress(finding.id);

      try {
        await onAcceptGap(finding.id);

        void sendTelemetryEvent(tenantId, {
          eventName: 'inspection_gap_actioned',
          missionId: missionId ?? undefined,
          eventData: {
            finding_id: finding.id,
            action: 'accept_gap',
            category: finding.category,
            severity: finding.severity,
          },
        });
      } catch (error) {
        console.error('Failed to accept inspection gap', error);
      } finally {
        setActionInProgress(null);
      }
    },
    [actionInProgress, missionId, onAcceptGap, tenantId],
  );

  const handleRegenerate = useCallback(
    async (finding: InspectionFinding) => {
      if (actionInProgress || !onRegenerate) {
        return;
      }

      setActionInProgress(finding.id);

      try {
        await onRegenerate(finding.id);

        void sendTelemetryEvent(tenantId, {
          eventName: 'inspection_gap_actioned',
          missionId: missionId ?? undefined,
          eventData: {
            finding_id: finding.id,
            action: 'regenerate',
            category: finding.category,
            severity: finding.severity,
          },
        });
      } catch (error) {
        console.error('Failed to regenerate from inspection finding', error);
      } finally {
        setActionInProgress(null);
      }
    },
    [actionInProgress, missionId, onRegenerate, tenantId],
  );

  const handleDismiss = useCallback(
    async (finding: InspectionFinding) => {
      if (actionInProgress || !onDismiss) {
        return;
      }

      setActionInProgress(finding.id);

      try {
        await onDismiss(finding.id);

        void sendTelemetryEvent(tenantId, {
          eventName: 'inspection_gap_actioned',
          missionId: missionId ?? undefined,
          eventData: {
            finding_id: finding.id,
            action: 'dismiss',
            category: finding.category,
            severity: finding.severity,
          },
        });
      } catch (error) {
        console.error('Failed to dismiss inspection finding', error);
      } finally {
        setActionInProgress(null);
      }
    },
    [actionInProgress, missionId, onDismiss, tenantId],
  );

  if (findings.length === 0) {
    return (
      <section className="rounded-xl border border-white/10 bg-slate-900/80 p-6">
        <div className="text-center">
          <p className="text-sm text-slate-400">
            No inspection findings. Coverage meter shows all checks passing.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <h3 className="text-lg font-semibold text-white">Inspection Findings</h3>
        <p className="mt-1 text-xs text-slate-400">
          Review coverage gaps, safeguard alerts, and risk signals before proceeding to planning.
        </p>
      </header>

      <div className="space-y-6">
        {categoriesWithFindings.map((category) => {
          const categoryFindings = groupedFindings[category];
          const config = CATEGORY_CONFIG[category];

          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-200">{config.label}</h4>
                <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
                  {categoryFindings.length}
                </span>
              </div>

              <div className="space-y-2">
                {categoryFindings.map((finding) => {
                  const severityConfig = SEVERITY_CONFIG[finding.severity];
                  const isExpanded = expandedFindingIds.has(finding.id);
                  const isActionInProgress = actionInProgress === finding.id;

                  return (
                    <article
                      key={finding.id}
                      className={`rounded-lg border p-4 transition ${severityConfig.colorClass}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start gap-2">
                            <span
                              className={`text-lg ${severityConfig.iconColorClass}`}
                              aria-label={severityConfig.label}
                            >
                              {severityConfig.icon}
                            </span>
                            <div className="flex-1">
                              <h5 className="font-semibold text-white">{finding.title}</h5>
                              {finding.description && (
                                <p className="mt-1 text-sm opacity-90">{finding.description}</p>
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="ml-7 space-y-3 border-t border-white/10 pt-3">
                              {finding.recommendation && (
                                <div className="rounded-lg bg-slate-950/60 p-3 text-sm">
                                  <p className="font-medium text-slate-200">Recommendation:</p>
                                  <p className="mt-1 opacity-90">{finding.recommendation}</p>
                                </div>
                              )}

                              {finding.affectedToolkits && finding.affectedToolkits.length > 0 && (
                                <div className="text-sm">
                                  <p className="font-medium text-slate-200">Affected toolkits:</p>
                                  <ul className="mt-1 flex flex-wrap gap-2">
                                    {finding.affectedToolkits.map((toolkit, idx) => (
                                      <li
                                        key={idx}
                                        className="rounded-md border border-white/10 bg-slate-950/60 px-2 py-1 text-xs"
                                      >
                                        {toolkit}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {finding.affectedObjectives && finding.affectedObjectives.length > 0 && (
                                <div className="text-sm">
                                  <p className="font-medium text-slate-200">Affected objectives:</p>
                                  <ul className="mt-1 list-disc space-y-1 pl-5 opacity-90">
                                    {finding.affectedObjectives.map((objective, idx) => (
                                      <li key={idx}>{objective}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(finding.id)}
                            className="text-xs text-white/60 hover:text-white"
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        </div>
                      </div>

                      <div className="ml-7 mt-3 flex flex-wrap gap-2">
                        {onAcceptGap && (
                          <button
                            type="button"
                            onClick={() => handleAcceptGap(finding)}
                            disabled={isActionInProgress}
                            className="rounded-md border border-white/20 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isActionInProgress ? 'Processing...' : 'Accept gap'}
                          </button>
                        )}

                        {onRegenerate && (
                          <button
                            type="button"
                            onClick={() => handleRegenerate(finding)}
                            disabled={isActionInProgress}
                            className="rounded-md border border-violet-400/40 bg-violet-500/20 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isActionInProgress ? 'Processing...' : 'Regenerate'}
                          </button>
                        )}

                        {onDismiss && (
                          <button
                            type="button"
                            onClick={() => handleDismiss(finding)}
                            disabled={isActionInProgress}
                            className="rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-950/60 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isActionInProgress ? 'Processing...' : 'Dismiss'}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
