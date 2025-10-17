"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  addApprovalComment,
  delegateApproval,
  exportApprovalToPDF,
  loadApprovalWorkspaceData,
  submitApprovalDecision,
} from "@/lib/data/approve-workspace";
import type {
  ApprovalHistoryEntry,
  ApprovalStatus,
  ApprovalWorkspaceData,
} from "@/lib/types/mission";
import { ApprovalDecisionPanel } from "@/components/workspace/approve/ApprovalDecisionPanel";
import { ApprovalHistoryTimeline } from "@/components/workspace/approve/ApprovalHistoryTimeline";
import { ApprovalSummaryCard } from "@/components/workspace/approve/ApprovalSummaryCard";

const DEFAULT_APPROVAL_ID = "demo-approval-1";

export default function ApprovePage() {
  const searchParams = useSearchParams();
  const approvalId = searchParams.get("approval") ?? DEFAULT_APPROVAL_ID;

  const [workspace, setWorkspace] = useState<ApprovalWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      setLoading(true);
      setError(null);

      try {
        const data = await loadApprovalWorkspaceData(approvalId);
        if (!cancelled) {
          setWorkspace(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load approval");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [approvalId]);

  const appendHistory = useCallback((entry: ApprovalHistoryEntry) => {
    setWorkspace((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        history: [entry, ...current.history],
      };
    });
  }, []);

  const updateStatus = useCallback((status: ApprovalStatus, rationale?: string | null) => {
    setWorkspace((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        approval: {
          ...current.approval,
          status,
          rationale: rationale ?? current.approval.rationale,
          decisionAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  const handleApprove = useCallback(
    async (rationale: string) => {
      if (!workspace) {
        return;
      }

      await submitApprovalDecision(workspace.approval.id, "approved", rationale);
      updateStatus("approved", rationale);
      appendHistory({
        id: `approved-${Date.now()}`,
        action: "approved",
        actor: workspace.approval.approverRole,
        actorRole: workspace.approval.approverRole,
        note: rationale,
        timestamp: new Date().toISOString(),
      });
    },
    [appendHistory, updateStatus, workspace],
  );

  const handleReject = useCallback(
    async (rationale: string) => {
      if (!workspace) {
        return;
      }

      await submitApprovalDecision(workspace.approval.id, "rejected", rationale);
      updateStatus("rejected", rationale);
      appendHistory({
        id: `rejected-${Date.now()}`,
        action: "rejected",
        actor: workspace.approval.approverRole,
        actorRole: workspace.approval.approverRole,
        note: rationale,
        timestamp: new Date().toISOString(),
      });
    },
    [appendHistory, updateStatus, workspace],
  );

  const handleDelegate = useCallback(
    async (role: string, reason: string) => {
      if (!workspace) {
        return;
      }

      const updated = await delegateApproval(workspace.approval.id, {
        toRole: role,
        reason,
      });

      setWorkspace((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          approval: {
            ...current.approval,
            approverRole: updated.approverRole,
            status: updated.status,
          },
        };
      });

      appendHistory({
        id: `delegated-${Date.now()}`,
        action: "delegated",
        actor: workspace.approval.approverRole,
        actorRole: workspace.approval.approverRole,
        note: reason,
        timestamp: new Date().toISOString(),
      });
    },
    [appendHistory, workspace],
  );

  const handleComment = useCallback(
    async (content: string) => {
      if (!workspace) {
        return;
      }

      const comment = await addApprovalComment(workspace.approval.id, content);

      setWorkspace((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          comments: [comment, ...current.comments],
        };
      });
    },
    [workspace],
  );

  const handleExport = useCallback(async () => {
    await exportApprovalToPDF(approvalId);
  }, [approvalId]);

  const statusBadge = useMemo(() => {
    if (!workspace) {
      return null;
    }

    const { status } = workspace.approval;

    const styles: Record<ApprovalStatus, string> = {
      requested: "bg-slate-700 text-slate-200",
      delegated: "bg-amber-500/20 text-amber-200",
      approved: "bg-cyan-500/20 text-cyan-200",
      rejected: "bg-red-500/20 text-red-200",
      expired: "bg-slate-500/30 text-slate-200",
    };

    return (
      <span className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${styles[status]}`}>
        {status}
      </span>
    );
  }, [workspace]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading approval workspace…</p>
        </div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-2xl border border-red-500/40 bg-red-500/10 p-8 text-center">
          <h2 className="mb-2 text-lg font-semibold text-red-200">Unable to load approval</h2>
          <p className="text-sm text-red-300/80">{error ?? "Unknown error occurred"}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium uppercase tracking-wide text-amber-200">
            Stage 4 · Approve
          </span>
          {statusBadge}
        </div>
        <h1 className="text-3xl font-semibold text-slate-100">{workspace.approval.missionTitle}</h1>
        <p className="text-sm text-slate-400">
          Review the selected play, confirm safeguards, and capture an auditable decision before the
          mission advances to governed execution.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ApprovalSummaryCard summary={workspace.summary} />
        </div>
        <div className="space-y-8">
          <ApprovalDecisionPanel
            approvalId={workspace.approval.id}
            missionId={workspace.approval.missionId}
            status={workspace.approval.status}
            onApprove={handleApprove}
            onReject={handleReject}
            onDelegate={handleDelegate}
            onExport={handleExport}
          />
          <ApprovalHistoryTimeline
            history={workspace.history}
            comments={workspace.comments}
            onAddComment={handleComment}
          />
        </div>
      </div>
    </div>
  );
}
