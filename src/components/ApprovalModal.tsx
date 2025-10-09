"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalSubmission,
  SubmitResult,
} from '@/hooks/useApprovalFlow';

type ApprovalModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (submission: ApprovalSubmission) => Promise<SubmitResult>;
  request?: ApprovalRequest | null;
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

export function ApprovalModal({ isOpen, isSubmitting, error, onClose, onSubmit, request }: ApprovalModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const [decision, setDecision] = useState<ApprovalDecision>('approved');
  const [justification, setJustification] = useState('');
  const [violationChecked, setViolationChecked] = useState(false);
  const [violationNotes, setViolationNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const toolCallId = useMemo(() => request?.toolCallId ?? null, [request?.toolCallId]);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement;
      setDecision('approved');
      setJustification('');
      setViolationChecked(false);
      setViolationNotes('');
      setLocalError(null);

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

  if (!isOpen) {
    return null;
  }

  const combinedError = localError ?? error ?? null;

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

        {combinedError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
          >
            {combinedError}
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
