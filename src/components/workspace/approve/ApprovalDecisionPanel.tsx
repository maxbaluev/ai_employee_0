"use client";

import { useState } from "react";

import { emitTelemetry } from "@/lib/telemetry/client";
import type { ApprovalStatus } from "@/lib/types/mission";

type ApprovalDecisionPanelProps = {
  approvalId: string;
  missionId: string;
  status: ApprovalStatus;
  onApprove: (rationale: string) => Promise<void>;
  onReject: (rationale: string) => Promise<void>;
  onDelegate: (toRole: string, reason: string) => Promise<void>;
  onExport: () => Promise<void>;
};

export function ApprovalDecisionPanel({
  approvalId,
  missionId,
  status,
  onApprove,
  onReject,
  onDelegate,
  onExport,
}: ApprovalDecisionPanelProps) {
  const [rationale, setRationale] = useState("");
  const [delegateRole, setDelegateRole] = useState("");
  const [delegateReason, setDelegateReason] = useState("");
  const [showDelegateForm, setShowDelegateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isResolved = status === "approved" || status === "rejected";

  async function handleApprove() {
    setError(null);
    setIsSubmitting(true);

    try {
      await onApprove(rationale);
      emitTelemetry("approval_granted", {
        approval_id: approvalId,
        mission_id: missionId,
        has_rationale: Boolean(rationale.trim()),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to approve request");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    if (!rationale.trim()) {
      setError("Provide a rationale before rejecting the request.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onReject(rationale);
      emitTelemetry("approval_rejected", {
        approval_id: approvalId,
        mission_id: missionId,
        rationale_length: rationale.trim().length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reject request");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelegate() {
    if (!delegateRole.trim() || !delegateReason.trim()) {
      setError("Role and reason are required to delegate an approval.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onDelegate(delegateRole.trim(), delegateReason.trim());
      emitTelemetry("approval_delegated", {
        approval_id: approvalId,
        mission_id: missionId,
        to_role: delegateRole.trim(),
      });
      setShowDelegateForm(false);
      setDelegateRole("");
      setDelegateReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delegate approval");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleExport() {
    setError(null);

    try {
      await onExport();
      emitTelemetry("approval_exported", {
        approval_id: approvalId,
        mission_id: missionId,
        format: "pdf",
      });
      emitTelemetry("audit_event_recorded", {
        approval_id: approvalId,
        mission_id: missionId,
        export_format: "pdf",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export approval summary");
    }
  }

  return (
    <section
      aria-labelledby="approval-decision-heading"
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
    >
      <h2 id="approval-decision-heading" className="mb-6 text-lg font-semibold text-slate-100">
        Approval Decision
      </h2>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label htmlFor="approval-rationale" className="mb-2 block text-sm font-medium text-slate-300">
            Rationale {status === "rejected" && <span className="text-red-400">*</span>}
          </label>
          <textarea
            id="approval-rationale"
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            disabled={isResolved || isSubmitting}
            placeholder="Explain your decision or provide reviewer guidance…"
            rows={4}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            aria-describedby={status === "rejected" ? "approval-rationale-hint" : undefined}
          />
          {status === "rejected" && (
            <p id="approval-rationale-hint" className="mt-1 text-xs text-slate-400">
              A rationale is required when rejecting an approval request.
            </p>
          )}
        </div>

        {!isResolved && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-cyan-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Processing…" : "Approve"}
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-red-500/40 bg-red-500/10 px-6 py-3 text-sm font-medium text-red-200 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Processing…" : "Reject"}
            </button>
          </div>
        )}

        {isResolved && (
          <div
            className={`rounded-lg border p-4 text-sm font-medium ${
              status === "approved"
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                : "border-red-500/40 bg-red-500/10 text-red-200"
            }`}
            role="status"
            aria-live="polite"
          >
            {status === "approved" ? "Approved" : "Rejected"}
          </div>
        )}

        <div className="border-t border-slate-800 pt-6">
          <button
            type="button"
            onClick={() => setShowDelegateForm((value) => !value)}
            disabled={isResolved || isSubmitting}
            className="text-sm font-medium text-cyan-400 transition hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-expanded={showDelegateForm}
            aria-controls="approval-delegate-form"
          >
            {showDelegateForm ? "Cancel delegation" : "Delegate to another approver"}
          </button>

          {showDelegateForm && (
            <div id="approval-delegate-form" className="mt-4 space-y-4">
              <div>
                <label htmlFor="approval-delegate-role" className="mb-2 block text-sm font-medium text-slate-300">
                  Delegate to role *
                </label>
                <input
                  id="approval-delegate-role"
                  type="text"
                  value={delegateRole}
                  onChange={(event) => setDelegateRole(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. governance, senior-operator"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div>
                <label htmlFor="approval-delegate-reason" className="mb-2 block text-sm font-medium text-slate-300">
                  Reason *
                </label>
                <textarea
                  id="approval-delegate-reason"
                  value={delegateReason}
                  onChange={(event) => setDelegateReason(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Describe why this approval should be delegated…"
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                onClick={handleDelegate}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Delegating…" : "Delegate approval"}
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 pt-6">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3h8v4m-4 5v9m0 0l-3.5-3.5M12 21l3.5-3.5M4 11h16"
              />
            </svg>
            Export to PDF
          </button>
        </div>
      </div>
    </section>
  );
}
