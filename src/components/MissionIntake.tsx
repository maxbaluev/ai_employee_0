"use client";

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';

import { sendTelemetryEvent } from '@/lib/telemetry/client';

import type { GeneratedSafeguard, IntakeChips, KPI } from '@/lib/intake/service';

type SafeguardStatus = GeneratedSafeguard['status'];

type IntakeViewState = {
  missionId: string;
  objective: string;
  audience: string;
  kpis: KPI[];
  safeguards: GeneratedSafeguard[];
  confidence: number;
};

type AcceptedIntakePayload = {
  missionId: string;
  objective: string;
  audience: string;
  guardrailSummary: string;
  kpis: KPI[];
  confidence: number;
};

type RegenerationField = 'objective' | 'audience' | 'kpis' | 'safeguards';

const MAX_REGENERATIONS = 3;
const INITIAL_REGEN_COUNTS: Record<RegenerationField, number> = {
  objective: 0,
  audience: 0,
  kpis: 0,
  safeguards: 0,
};

type MissionIntakeProps = {
  tenantId: string;
  objectiveId?: string | null;
  onAccept: (payload: AcceptedIntakePayload) => Promise<void> | void;
  onStageAdvance?: () => void;
};

export function MissionIntake({ tenantId, objectiveId, onAccept, onStageAdvance }: MissionIntakeProps) {
  const [rawInput, setRawInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [intakeState, setIntakeState] = useState<IntakeViewState | null>(null);
  const [editingField, setEditingField] = useState<'objective' | 'audience' | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [localEdits, setLocalEdits] = useState<Set<'objective' | 'audience'>>(() => new Set());
  const [regenerationCounts, setRegenerationCounts] = useState<Record<RegenerationField, number>>(INITIAL_REGEN_COUNTS);

  const links = useMemo(() => extractLinks(rawInput), [rawInput]);
  const approximateTokens = useMemo(() => {
    if (!rawInput.trim()) {
      return 0;
    }
    return Math.max(1, Math.ceil(rawInput.length / 4));
  }, [rawInput]);

  useCopilotReadable({
    description: 'Mission intake workspace state',
    value: {
      input: rawInput,
      missionId: intakeState?.missionId ?? null,
      objective: intakeState?.objective ?? null,
      audience: intakeState?.audience ?? null,
      kpis: intakeState?.kpis ?? [],
      safeguards: intakeState?.safeguards ?? [],
      confidence: intakeState?.confidence ?? null,
    },
  });

  const updateSafeguardStatus = useCallback((id: string, nextStatus: SafeguardStatus) => {
    setIntakeState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        safeguards: prev.safeguards.map((hint) =>
          hint.id === id
            ? {
                ...hint,
                status: nextStatus,
              }
            : hint,
        ),
      };
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!rawInput.trim()) {
      setErrorMessage('Add a mission objective or context before generating.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/intake/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: rawInput,
          links,
          missionId: intakeState?.missionId ?? objectiveId ?? undefined,
          tenantId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Failed to generate mission intake');
      }

      const payload = (await response.json()) as { missionId: string; chips: IntakeChips };

      const nextState: IntakeViewState = {
        missionId: payload.missionId,
        objective: payload.chips.objective,
        audience: payload.chips.audience,
        kpis: payload.chips.kpis,
        safeguards: payload.chips.safeguardHints,
        confidence: payload.chips.confidence,
      };

      setIntakeState(nextState);
      setLocalEdits(new Set());
      setRegenerationCounts({ ...INITIAL_REGEN_COUNTS });
    } catch (error) {
      console.error('[MissionIntake] generate failed', error);
      setErrorMessage(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [rawInput, links, intakeState?.missionId, objectiveId, tenantId]);

  const handleRegenerateField = useCallback(
    async (field: RegenerationField) => {
      if (!intakeState) return;

      if (regenerationCounts[field] >= MAX_REGENERATIONS) {
        setErrorMessage(`Regeneration limit reached for ${field}. Please edit manually.`);
        return;
      }

      setIsGenerating(true);
      setErrorMessage(null);

      try {
        const response = await fetch('/api/intake/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            missionId: intakeState.missionId,
            tenantId,
            field,
            context: rawInput,
          }),
        });

        if (response.status === 429) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          const limitMessage = payload.error ?? 'Regeneration limit reached. Please edit manually.';
          setErrorMessage(limitMessage);
          setRegenerationCounts((prev) => ({ ...prev, [field]: MAX_REGENERATIONS }));
          return;
        }

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? 'Regeneration failed');
        }

        const payload = (await response.json()) as { chips: IntakeChips };
        setIntakeState((prev) =>
          prev
            ? {
                ...prev,
                objective: field === 'objective' ? payload.chips.objective : prev.objective,
                audience: field === 'audience' ? payload.chips.audience : prev.audience,
                kpis: field === 'kpis' ? payload.chips.kpis : prev.kpis,
                safeguards: field === 'safeguards' ? payload.chips.safeguardHints : prev.safeguards,
                confidence: payload.chips.confidence,
              }
            : prev,
        );
        setRegenerationCounts((prev) => ({ ...prev, [field]: prev[field] + 1 }));
        setLocalEdits((prev) => {
          if (!prev.size) return prev;
          const next = new Set(prev);
          if (field === 'objective' || field === 'audience') {
            next.delete(field);
          }
          return next;
        });
      } catch (error) {
        console.error('[MissionIntake] regenerate failed', error);
        setErrorMessage((prev) =>
          prev ?? (error instanceof Error ? error.message : 'Regeneration failed'),
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [intakeState, tenantId, rawInput, regenerationCounts],
  );

  const handleSaveEdit = useCallback(
    async (field: 'objective' | 'audience') => {
      if (!intakeState) return;

      const trimmed = editDraft.trim();
      setIntakeState((prev) =>
        prev
          ? {
              ...prev,
              [field]: trimmed || prev[field],
            }
          : prev,
      );

      const nextEdits = new Set(localEdits);
      nextEdits.add(field);
      setLocalEdits(nextEdits);

      setEditingField(null);
      setEditDraft('');

      await sendTelemetryEvent(tenantId, {
        eventName: 'brief_item_modified',
        missionId: intakeState.missionId,
        eventData: { field, action: 'edit' },
      });
    },
    [intakeState, editDraft, localEdits, tenantId],
  );

  const handleAccept = useCallback(async () => {
    if (!intakeState) {
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const safeguardStatuses = intakeState.safeguards.map((hint) => ({
        id: hint.id ?? '',
        status: hint.status === 'suggested' ? 'accepted' : hint.status,
      }));

      const acceptResponse = await fetch('/api/intake/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionId: intakeState.missionId,
          tenantId,
          fields: ['objective', 'audience', 'kpis'],
          safeguards: safeguardStatuses,
        }),
      });

      if (!acceptResponse.ok) {
        const payload = await acceptResponse.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Failed to record acceptance');
      }

      await onAccept({
        missionId: intakeState.missionId,
        objective: intakeState.objective,
        audience: intakeState.audience,
        guardrailSummary: intakeState.safeguards.map((hint) => hint.text).join('\n'),
        kpis: intakeState.kpis,
        confidence: intakeState.confidence,
      });

      setIntakeState((prev) =>
        prev
          ? {
              ...prev,
              safeguards: prev.safeguards.map((hint) => ({
                ...hint,
                status: hint.status === 'rejected' ? 'rejected' : 'accepted',
              })),
            }
          : prev,
      );
      setLocalEdits(new Set());

      // Notify stage advancement after successful acceptance
      onStageAdvance?.();
    } catch (error) {
      console.error('[MissionIntake] accept failed', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to accept mission intake');
    } finally {
      setIsGenerating(false);
    }
  }, [intakeState, onAccept, onStageAdvance, tenantId]);

  const handleReset = useCallback(async () => {
    setIntakeState(null);
    setLocalEdits(new Set());
    setEditingField(null);
    setEditDraft('');
    setErrorMessage(null);
    setRegenerationCounts({ ...INITIAL_REGEN_COUNTS });

    await sendTelemetryEvent(tenantId, {
      eventName: 'brief_item_modified',
      missionId: intakeState?.missionId,
      eventData: { action: 'reset' },
    });
  }, [intakeState?.missionId, tenantId]);

  useCopilotAction({
    name: 'generateMissionIntake',
    description: 'Generate mission intake chips from user input',
    parameters: [{ name: 'rawText', type: 'string', required: true }],
    handler: async ({ rawText }) => {
      setRawInput(rawText);
      await handleGenerate();
      return 'Mission intake generated';
    },
  });

  useCopilotAction({
    name: 'acceptMissionIntake',
    description: 'Accept the generated mission intake',
    parameters: [],
    handler: async () => {
      await handleAccept();
      return 'Mission intake accepted';
    },
  });

  useCopilotAction({
    name: 'regenerateMissionField',
    description: 'Regenerate a specific mission intake field',
    parameters: [{ name: 'field', type: 'string', required: true }],
    handler: async ({ field }) => {
      if (field === 'objective' || field === 'audience' || field === 'kpis' || field === 'safeguards') {
        await handleRegenerateField(field);
        return `Regenerated ${field}`;
      }
      return `Unsupported field: ${field}`;
    },
  });

  return (
    <section
      className="border-b border-white/10 bg-gradient-to-br from-slate-950 via-slate-950/90 to-violet-950/40 px-6 py-8"
      suppressHydrationWarning
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-violet-300">Generative intake</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Describe the mission in one go</h2>
            <p className="mt-1 text-sm text-slate-300">
              Paste context once—objective, audience, KPIs, tone. We will scaffold the mission brief and safeguards.
            </p>
          </div>
          {intakeState && (
            <div className="flex items-center gap-3 rounded-full bg-white/5 px-3 py-1.5 text-xs text-slate-200">
              <ConfidenceBadge confidence={intakeState.confidence} />
            </div>
          )}
        </header>

        <div className="space-y-3" suppressHydrationWarning>
          <label className="flex flex-col gap-2" suppressHydrationWarning>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Mission context</span>
            <textarea
              suppressHydrationWarning
              data-form-type="other"
              autoComplete="off"
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  void handleGenerate();
                }
              }}
              rows={intakeState ? 4 : 6}
              className="w-full rounded-lg border border-white/15 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-violet-400"
              placeholder="Goal, audience, timelines, links..."
              aria-label="Mission input"
              disabled={isGenerating}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <span>
              Ctrl + Enter to generate · {rawInput.length} characters
              {rawInput.trim() ? ` (~${approximateTokens} tokens)` : ''} · No data stored until you accept.
            </span>
            <div className="flex items-center gap-2">
              {links.length > 0 && <span>{links.length} link(s) detected</span>}
              <button
                suppressHydrationWarning
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating || !rawInput.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? 'Generating…' : intakeState ? 'Regenerate mission' : 'Generate mission'}
              </button>
            </div>
          </div>
          {errorMessage && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {errorMessage}
            </div>
          )}
        </div>

        {intakeState && (
          <div className="space-y-6 rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-lg">
            <MissionChip
              label="Objective"
              value={intakeState.objective}
              isEditing={editingField === 'objective'}
              hasLocalEdit={localEdits.has('objective')}
              editValue={editingField === 'objective' ? editDraft : intakeState.objective}
              onEdit={() => {
                setEditingField('objective');
                setEditDraft(intakeState.objective);
              }}
              onCancel={() => {
                setEditingField(null);
                setEditDraft('');
              }}
              onSave={() => void handleSaveEdit('objective')}
              onChange={(value) => setEditDraft(value)}
              onRegenerate={() => void handleRegenerateField('objective')}
              isBusy={isGenerating}
            />

            <MissionChip
              label="Audience"
              value={intakeState.audience}
              isEditing={editingField === 'audience'}
              hasLocalEdit={localEdits.has('audience')}
              editValue={editingField === 'audience' ? editDraft : intakeState.audience}
              onEdit={() => {
                setEditingField('audience');
                setEditDraft(intakeState.audience);
              }}
              onCancel={() => {
                setEditingField(null);
                setEditDraft('');
              }}
              onSave={() => void handleSaveEdit('audience')}
              onChange={(value) => setEditDraft(value)}
              onRegenerate={() => void handleRegenerateField('audience')}
              isBusy={isGenerating}
            />

            <KPICards kpis={intakeState.kpis} onRegenerate={() => void handleRegenerateField('kpis')} isBusy={isGenerating} />

            <SafeguardList
              safeguards={intakeState.safeguards}
              onToggle={(id) => {
                const current = intakeState.safeguards.find((hint) => hint.id === id);
                if (!current) return;
                const nextStatus = cycleSafeguardStatus(current.status);
                updateSafeguardStatus(id, nextStatus);
              }}
              onRefresh={() => void handleRegenerateField('safeguards')}
              isBusy={isGenerating}
            />

            <footer className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => void handleAccept()}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Accept mission intake
              </button>
              <button
                type="button"
                onClick={() => void handleReset()}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reset
              </button>
            </footer>
          </div>
        )}
      </div>
    </section>
  );
}

type MissionChipProps = {
  label: string;
  value: string;
  isEditing: boolean;
  hasLocalEdit: boolean;
  isBusy: boolean;
  editValue: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (value: string) => void;
  onRegenerate: () => void;
};

function MissionChip({
  label,
  value,
  isEditing,
  hasLocalEdit,
  isBusy,
  editValue,
  onEdit,
  onCancel,
  onSave,
  onChange,
  onRegenerate,
}: MissionChipProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
        {label}
        {hasLocalEdit && (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
            Edited
          </span>
        )}
      </div>
      {isEditing ? (
        <div className="flex flex-wrap items-center gap-2" suppressHydrationWarning>
          <input
            type="text"
            suppressHydrationWarning
            data-form-type="other"
            autoComplete="off"
            value={editValue}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSave();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
              }
            }}
            autoFocus
            className="flex-1 min-w-[200px] rounded-lg border border-violet-400 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none"
          />
          <button
            type="button"
            onClick={() => onSave()}
            className="rounded-md bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-400"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => onCancel()}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2" suppressHydrationWarning>
          <p className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm leading-relaxed text-slate-100">
            {value}
          </p>
          <button
            type="button"
            onClick={() => onEdit()}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            disabled={isBusy}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onRegenerate()}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            disabled={isBusy}
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

type KPICardsProps = {
  kpis: KPI[];
  onRegenerate: () => void;
  isBusy: boolean;
};

function KPICards({ kpis, onRegenerate, isBusy }: KPICardsProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">KPIs</span>
        <button
          type="button"
          onClick={() => onRegenerate()}
          className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300 transition hover:bg-white/10"
          disabled={isBusy}
        >
          Regenerate
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {kpis.length === 0 && (
          <span className="rounded-lg border border-dashed border-white/15 px-3 py-2 text-xs text-slate-400">
            No KPIs generated yet
          </span>
        )}
        {kpis.map((kpi, index) => (
          <div
            key={`${kpi.label}-${index}`}
            className="inline-flex flex-col rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
          >
            <span className="font-medium text-white">{kpi.label}</span>
            {kpi.target && <span className="text-xs text-violet-300">Target: {kpi.target}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

type SafeguardListProps = {
  safeguards: GeneratedSafeguard[];
  onToggle: (id: string) => void;
  onRefresh: () => void;
  isBusy: boolean;
};

function SafeguardList({ safeguards, onToggle, onRefresh, isBusy }: SafeguardListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">Safeguard hints</span>
        <button
          type="button"
          onClick={() => onRefresh()}
          className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300 transition hover:bg-white/10"
          disabled={isBusy}
        >
          Refresh set
        </button>
      </div>
      <div className="space-y-2">
        {safeguards.map((hint) => (
          <div
            key={hint.id ?? hint.text}
            className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3"
          >
            <div className="mt-1 h-2 w-2 rounded-full bg-violet-400" aria-hidden />
            <div className="flex-1 space-y-1 text-sm text-slate-100">
              <p>{hint.text}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="rounded-full bg-white/5 px-2 py-0.5 uppercase tracking-wide text-[10px]">
                  {hint.hintType.replace('_', ' ')}
                </span>
                <ConfidenceBadge confidence={hint.confidence} />
                <button
                  type="button"
                  onClick={() => hint.id && onToggle(hint.id)}
                  className={getSafeguardButtonClasses(hint.status)}
                  disabled={!hint.id}
                >
                  {statusLabel(hint.status)}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type ConfidenceBadgeProps = {
  confidence: number;
};

function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  if (confidence >= 0.85) {
    return <Badge className="bg-emerald-500/20 text-emerald-300">High confidence</Badge>;
  }
  if (confidence >= 0.7) {
    return <Badge className="bg-amber-500/20 text-amber-300">Medium confidence</Badge>;
  }
  return <Badge className="bg-orange-500/20 text-orange-300">Low confidence</Badge>;
}

type BadgeProps = {
  children: ReactNode;
  className?: string;
};

function Badge({ children, className }: BadgeProps) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className ?? ''}`}>
      {children}
    </span>
  );
}

function statusLabel(status: SafeguardStatus): string {
  if (status === 'accepted') return 'Accepted';
  if (status === 'edited') return 'Review';
  if (status === 'rejected') return 'Rejected';
  return 'Suggested';
}

function getSafeguardButtonClasses(status: SafeguardStatus): string {
  const base = 'px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full transition disabled:cursor-not-allowed disabled:opacity-60';
  switch (status) {
    case 'accepted':
      return `${base} bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30`;
    case 'edited':
      return `${base} bg-amber-500/20 text-amber-300 hover:bg-amber-500/30`;
    case 'rejected':
      return `${base} bg-red-500/20 text-red-300 hover:bg-red-500/30`;
    default:
      return `${base} bg-white/5 text-slate-200 hover:bg-white/10`;
  }
}

function cycleSafeguardStatus(status: SafeguardStatus): SafeguardStatus {
  if (status === 'suggested') return 'accepted';
  if (status === 'accepted') return 'rejected';
  if (status === 'rejected') return 'suggested';
  return 'suggested';
}

function extractLinks(value: string): string[] {
  const pattern = /https?:\/\/[^\s]+/gi;
  const matches = value.match(pattern);
  if (!matches) return [];
  return Array.from(new Set(matches));
}
