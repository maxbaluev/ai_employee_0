"use client";

import { useCallback, useMemo, useState } from 'react';

import { sendTelemetryEvent } from '@/lib/telemetry/client';

export type ApprovalDecision = 'approved' | 'rejected' | 'needs_changes';

export type ApprovalRequest = {
  toolCallId: string;
  missionId?: string | null;
  stage?: string | null;
  attempt?: number | null;
  metadata?: Record<string, unknown>;
};

export type ApprovalSubmission = {
  decision: ApprovalDecision;
  justification?: string;
  guardrailViolation?: {
    violated: boolean;
    notes?: string;
  };
};

type UseApprovalFlowOptions = {
  tenantId: string;
  missionId?: string | null;
  defaultReviewerId?: string | null;
  onSuccess?: (payload: { decision: ApprovalDecision; approvalId?: string | null }) => void;
};

export type SubmitResult =
  | { ok: true; approvalId: string | null }
  | { ok: false; error: string };

export function useApprovalFlow(options: UseApprovalFlowOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRequest, setCurrentRequest] = useState<ApprovalRequest | null>(null);
  const [latestDecision, setLatestDecision] = useState<ApprovalDecision | null>(null);

  const missionId = useMemo(
    () => currentRequest?.missionId ?? options.missionId ?? null,
    [currentRequest?.missionId, options.missionId],
  );

  const openApproval = useCallback(
    (request: ApprovalRequest) => {
      const missionContext = request.missionId ?? options.missionId ?? null;
      setCurrentRequest({ ...request, missionId: missionContext });
      setError(null);
      setIsOpen(true);

      void sendTelemetryEvent(options.tenantId, {
        eventName: 'approval_required',
        missionId: missionContext,
        eventData: {
          tool_call_id: request.toolCallId,
          stage: request.stage ?? null,
          attempt: request.attempt ?? null,
        },
      });
    },
    [options.missionId, options.tenantId],
  );

  const closeApproval = useCallback(() => {
    setIsOpen(false);
  }, []);

  const submitApproval = useCallback(
    async (submission: ApprovalSubmission): Promise<SubmitResult> => {
      if (!currentRequest) {
        const message = 'No approval request is active.';
        setError(message);
        return { ok: false, error: message };
      }

      setIsSubmitting(true);
      setError(null);

      const payload = {
        tenantId: options.tenantId,
        missionId,
        toolCallId: currentRequest.toolCallId,
        reviewerId: options.defaultReviewerId ?? undefined,
        decision: submission.decision,
        justification: submission.justification?.trim() || undefined,
        metadata: currentRequest.metadata ?? {},
        guardrailViolation: submission.guardrailViolation,
      };

      try {
        const response = await fetch('/api/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          const message = errorPayload.error ?? 'Failed to persist approval decision';
          setError(message);
          return { ok: false, error: message };
        }

        const body = (await response.json()) as { approval?: { id?: string | null } | null };
        const approvalId = body.approval?.id ?? null;

        await sendTelemetryEvent(options.tenantId, {
          eventName: 'approval_decision',
          missionId,
          eventData: {
            tool_call_id: currentRequest.toolCallId,
            decision: submission.decision,
            has_guardrail_violation: submission.guardrailViolation?.violated ?? false,
          },
        });

        const trimmedJustification = submission.justification?.trim();
        const violationNotes = submission.guardrailViolation?.notes?.trim();
        if (trimmedJustification || violationNotes) {
          await sendTelemetryEvent(options.tenantId, {
            eventName: 'reviewer_annotation_created',
            missionId,
            eventData: {
              tool_call_id: currentRequest.toolCallId,
              decision: submission.decision,
              has_guardrail_violation: submission.guardrailViolation?.violated ?? false,
            },
          });
        }

        setIsOpen(false);
        setLatestDecision(submission.decision);
        options.onSuccess?.({ decision: submission.decision, approvalId });

        return { ok: true, approvalId };
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'Unexpected approval failure';
        setError(message);
        return { ok: false, error: message };
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentRequest, missionId, options.defaultReviewerId, options.onSuccess, options.tenantId],
  );

  return {
    isOpen,
    isSubmitting,
    error,
    latestDecision,
    currentRequest,
    openApproval,
    closeApproval,
    submitApproval,
    clearError: () => setError(null),
  } as const;
}
