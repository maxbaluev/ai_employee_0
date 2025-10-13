"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalSubmission,
  SubmitResult,
} from '@/hooks/useApprovalFlow';

type SafeguardChip = {
  type: string;
  value: string;
  confidence?: number;
  status?: string;
};

type ApprovalModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (submission: ApprovalSubmission) => Promise<SubmitResult>;
  request?: ApprovalRequest | null;
  safeguardChips?: SafeguardChip[];
  undoSummary?: string;
  impactEstimate?: string;
  effortEstimate?: string;
  latestDecision?: ApprovalDecision | null;
  emitTelemetry?: (eventName: string, eventData?: Record<string, unknown>) => void;
};

const DECISION_OPTIONS: Array<{ value: ApprovalDecision; label: string; helper: string }> = [
  {
    value: 'approved',
    label: 'Approve dry-run',
    helper: 'Confident in safeguards and undo plan.',
  },
  {
    value: 'needs_changes',
    label: 'Needs revision',
    helper: 'Send back with required edits before activation.',
  },
  {
    value: 'rejected',
    label: 'Reject request',
    helper: 'Block release and log guardrail violation.',
  },
];

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];
  return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(',')));
}

export function ApprovalModal({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
  request,
  safeguardChips = [],
  undoSummary,
  impactEstimate,
  effortEstimate,
  latestDecision = null,
  emitTelemetry,
}: ApprovalModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const [decision, setDecision] = useState<ApprovalDecision>('approved');
  const [justification, setJustification] = useState('');
  const [violationChecked, setViolationChecked] = useState(false);
  const [violationNotes, setViolationNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isInlineEditing, setInlineEditing] = useState(false);
  const [inlineDraft, setInlineDraft] = useState('');

  const toolCallId = useMemo(() => request?.toolCallId ?? null, [request?.toolCallId]);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement;
      setDecision('approved');
      setJustification('');
      setViolationChecked(false);
      setViolationNotes('');
      setLocalError(null);
      setInlineEditing(false);
      setInlineDraft('');

      requestAnimationFrame(() => {
        const focusable = getFocusableElements(dialogRef.current);
        focusable[0]?.focus();
      });
    } else if (previouslyFocusedRef.current instanceof HTMLElement) {
      previouslyFocusedRef.current.focus({ preventScroll: true });
    }
  }, [isOpen]);

  const guardrailPayload = useMemo(() => {
    if (!violationChecked && !violationNotes.trim()) {
      return undefined;
    }

    return {
      violated: violationChecked,
      notes: violationNotes.trim() || undefined,
    };
  }, [violationChecked, violationNotes]);

  const handleSubmit = useCallback(async () => {
    if (!toolCallId) {
      setLocalError('Missing tool call context from streaming metadata.');
      return;
    }

    setLocalError(null);

    const result = await onSubmit({
      decision,
      justification: justification.trim(),
      guardrailViolation: guardrailPayload,
      safeguards: safeguardChips.length ? safeguardChips.map((chip) => ({
        type: chip.type,
        value: chip.value,
        confidence: chip.confidence,
      })) : undefined,
    });

    if (!result.ok) {
      setLocalError(result.error);
    }
  }, [decision, guardrailPayload, justification, onSubmit, toolCallId]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'enter') {
        event.preventDefault();
        void handleSubmit();
        return;
      }

      if (event.key === 'Tab') {
        const focusable = getFocusableElements(dialogRef.current);
        if (!focusable.length) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, isOpen, onClose]);

  const combinedError = localError ?? error ?? null;
  const hasConflict = combinedError?.includes('already recorded') ?? false;
  const isOptimisticUpdate = isSubmitting && latestDecision !== null && latestDecision !== decision;

  const metadata =
    request?.metadata && typeof request.metadata === 'object'
      ? (request.metadata as Record<string, unknown>)
      : null;
  const validatorSummary =
    typeof metadata?.validatorSummary === 'string' ? (metadata.validatorSummary as string) : null;
  const quickFixRaw = metadata?.['quickFix'];
  const quickFix =
    quickFixRaw && typeof quickFixRaw === 'object'
      ? (quickFixRaw as { summary?: string; suggestion?: string })
      : null;
  const inlineEditEnabled = Boolean(metadata?.['enableInlineEdit']) && safeguardChips.length > 0;
  const conflictRaw = metadata?.['conflict'];
  const conflictDetails =
    conflictRaw && typeof conflictRaw === 'object'
      ? (conflictRaw as {
          reviewer?: string;
          decision?: string;
          timestamp?: string;
        })
      : null;

  const primarySafeguardLabel = safeguardChips[0]?.value ?? '';

  const emitQuickFixTelemetry = useCallback(
    (eventName: string, eventData: Record<string, unknown>) => {
      emitTelemetry?.(eventName, eventData);
    },
    [emitTelemetry],
  );

  const handleQuickFixApply = useCallback(() => {
    if (!quickFix?.summary) {
      return;
    }

    emitQuickFixTelemetry('validator_quick_fix_applied', {
      tool_call_id: toolCallId,
      quick_fix_summary: quickFix.summary,
      quick_fix_suggestion: quickFix.suggestion,
    });
  }, [emitQuickFixTelemetry, quickFix, toolCallId]);

  const handleQuickFixEdit = useCallback(() => {
    if (!quickFix?.summary) {
      return;
    }

    emitQuickFixTelemetry('validator_quick_fix_edit', {
      tool_call_id: toolCallId,
      quick_fix_summary: quickFix.summary,
    });
  }, [emitQuickFixTelemetry, quickFix, toolCallId]);

  const handleQuickFixSendAnyway = useCallback(() => {
    if (!quickFix?.summary) {
      return;
    }

    emitQuickFixTelemetry('validator_quick_fix_send_anyway', {
      tool_call_id: toolCallId,
      quick_fix_summary: quickFix.summary,
      decision: decision,
    });
  }, [decision, emitQuickFixTelemetry, quickFix, toolCallId]);

  const handleInlineEditStart = useCallback(() => {
    if (!inlineEditEnabled) {
      return;
    }
    setInlineEditing(true);
    setInlineDraft(primarySafeguardLabel);
  }, [inlineEditEnabled, primarySafeguardLabel]);

  const handleInlineEditCancel = useCallback(() => {
    setInlineEditing(false);
    setInlineDraft('');
  }, []);

  const handleInlineEditSave = useCallback(() => {
    const trimmed = inlineDraft.trim();
    if (!trimmed || trimmed === primarySafeguardLabel) {
      handleInlineEditCancel();
      return;
    }

    emitTelemetry?.('modal_safeguard_edit_saved', {
      tool_call_id: toolCallId,
      safeguard_label: trimmed,
    });
    setInlineEditing(false);
    setInlineDraft('');
  }, [emitTelemetry, handleInlineEditCancel, inlineDraft, primarySafeguardLabel, toolCallId]);

  const conflictTelemetrySentRef = useRef(false);

  useEffect(() => {
    if (!hasConflict || !conflictDetails) {
      conflictTelemetrySentRef.current = false;
      return;
    }

    if (!conflictTelemetrySentRef.current) {
      emitTelemetry?.('approval_conflict_detected', {
        tool_call_id: toolCallId,
        conflicting_reviewer: conflictDetails.reviewer,
        conflicting_decision: conflictDetails.decision,
        conflicting_timestamp: conflictDetails.timestamp,
      });
      conflictTelemetrySentRef.current = true;
    }
  }, [conflictDetails, emitTelemetry, hasConflict, toolCallId]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-10 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-modal-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl rounded-2xl border border-white/15 bg-slate-950/95 p-6 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-300">Reviewer decision</p>
            <h2 id="approval-modal-title" className="mt-1 text-xl font-semibold text-white">
              {request?.stage ? request.stage.replace(/_/g, ' ') : 'Approve mission action'}
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Tool call: <span className="font-mono text-xs text-violet-200">{toolCallId ?? 'pending'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs uppercase tracking-wide text-slate-300 transition hover:bg-white/10"
          >
            Close
          </button>
        </header>

        {/* Safeguard Chips */}
        {safeguardChips.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Active safeguards</p>
            <div className="flex flex-wrap gap-2">
              {safeguardChips.map((chip, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-violet-500/10 px-3 py-1 text-xs"
                >
                  <span className="font-medium text-violet-200">{chip.type}</span>
                  <span className="text-slate-300">{chip.value}</span>
                  {chip.confidence && (
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                      {Math.round(chip.confidence * 100)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(validatorSummary || quickFix) && (
          <div className="mt-4 space-y-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-4">
            {validatorSummary && <p className="text-sm text-slate-100">{validatorSummary}</p>}
            {quickFix?.summary && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickFixApply}
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-500/30"
                >
                  Apply fix
                </button>
                <button
                  type="button"
                  onClick={handleQuickFixEdit}
                  className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:bg-white/20"
                >
                  Edit manually
                </button>
                <button
                  type="button"
                  onClick={handleQuickFixSendAnyway}
                  className="inline-flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:bg-amber-500/30"
                >
                  Send anyway
                </button>
              </div>
            )}
            {quickFix?.suggestion && (
              <p className="text-xs text-slate-300">{quickFix.suggestion}</p>
            )}
          </div>
        )}

        {inlineEditEnabled && (
          <div className="mt-4 rounded-lg border border-white/15 bg-white/5 p-4">
            {!isInlineEditing ? (
              <button
                type="button"
                onClick={handleInlineEditStart}
                className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:bg-white/20"
              >
                Edit safeguard inline
              </button>
            ) : (
              <div className="space-y-2">
                <label htmlFor="inline-safeguard-edit" className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Edit safeguard
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="inline-safeguard-edit"
                    name="inline-safeguard-edit"
                    value={inlineDraft}
                    onChange={(event) => setInlineDraft(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900/80 p-2 text-sm text-slate-100 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                  />
                  <button
                    type="button"
                    onClick={handleInlineEditSave}
                    className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-500/30"
                  >
                    Save safeguard edit
                  </button>
                  <button
                    type="button"
                    onClick={handleInlineEditCancel}
                    className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:bg-white/20"
                  >
                    Cancel edit
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Impact & Effort Meter */}
        {(impactEstimate || effortEstimate) && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {impactEstimate && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Impact</p>
                <p className="mt-1 text-sm font-semibold text-white">{impactEstimate}</p>
              </div>
            )}
            {effortEstimate && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Effort</p>
                <p className="mt-1 text-sm font-semibold text-white">{effortEstimate}</p>
              </div>
            )}
          </div>
        )}

        {/* Undo Summary */}
        {undoSummary && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-amber-500/20 p-1.5">
                <svg className="h-4 w-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Undo plan</p>
                <p className="mt-1 text-sm text-slate-200">{undoSummary}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3">
          {DECISION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDecision(option.value)}
              className={`flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                decision === option.value
                  ? 'border-violet-400/60 bg-violet-500/10 text-white shadow'
                  : 'border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10'
              }`}
              aria-pressed={decision === option.value}
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs text-slate-300">{option.helper}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <label htmlFor="approval-justification" className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Reviewer notes
          </label>
          <textarea
            id="approval-justification"
            name="approval-justification"
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 p-3 text-sm text-slate-100 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            placeholder="Summarise your decision, impact, or requested edits."
          />
        </div>

        <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
          <label className="flex items-center gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={violationChecked}
              onChange={(event) => setViolationChecked(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-transparent"
            />
            Log guardrail violation
          </label>
          <textarea
            value={violationNotes}
            onChange={(event) => setViolationNotes(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-slate-900/70 p-2 text-sm text-slate-100 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            placeholder="Optional: note what failed or the mitigation path."
          />
        </div>

        {isOptimisticUpdate && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-200"
          >
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 animate-spin text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p>Submitting <strong className="font-semibold">{latestDecision}</strong> decision...</p>
            </div>
          </div>
        )}

        {combinedError && (
          <div
            role="alert"
            className={`mt-4 rounded-lg border p-3 text-sm ${
              hasConflict
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                : 'border-red-500/40 bg-red-500/10 text-red-200'
            }`}
          >
            <div className="flex items-start gap-2">
              {hasConflict ? (
                <svg className="h-4 w-4 mt-0.5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 mt-0.5 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <div className="flex-1">
                <p className="font-semibold">{hasConflict ? 'Concurrent reviewer detected' : 'Submission failed'}</p>
                <p className="mt-1">{combinedError}</p>
                {hasConflict && conflictDetails?.decision && (
                  <p className="mt-1">{`Another reviewer marked this as ${conflictDetails.decision}.`}</p>
                )}
                {hasConflict && conflictDetails?.reviewer && (
                  <p className="text-xs text-slate-300">{conflictDetails.reviewer}</p>
                )}
                {hasConflict && conflictDetails?.timestamp && (
                  <p className="text-xs text-slate-400">{conflictDetails.timestamp}</p>
                )}
                {hasConflict && latestDecision && (
                  <p className="mt-2 text-xs">
                    Current state: <span className="font-mono rounded bg-white/10 px-1.5 py-0.5">{latestDecision}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">Ctrl/⌘ + Enter submits instantly.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="rounded-md border border-violet-500/40 bg-violet-500/20 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-violet-200 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting…' : 'Submit decision'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
