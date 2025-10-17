"use client";

import Link from "next/link";

import { MissionApproval } from "@/lib/types/mission";

const APPROVE_ROUTE = "/workspace/approve";

type ApprovalsCardProps = {
  approvals: MissionApproval[];
  onApprovalNavigate?: (approval: MissionApproval) => void;
};

export function ApprovalsCard({ approvals, onApprovalNavigate }: ApprovalsCardProps) {
  return (
    <section
      aria-labelledby="approvals-heading"
      className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 id="approvals-heading" className="text-lg font-semibold text-slate-100">
            Approvals waiting
          </h2>
          <p className="text-sm text-slate-400">
            Jump directly into the approval workspace to unblock missions.
          </p>
        </div>
        <Link
          href={APPROVE_ROUTE}
          onClick={() => {
            const nextApproval = approvals[0];
            if (nextApproval) {
              onApprovalNavigate?.(nextApproval);
            }
          }}
          className="rounded-full border border-cyan-500/40 px-4 py-2 text-xs font-medium text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/10"
        >
          Open approvals
        </Link>
      </header>

      <ul className="space-y-3" aria-label="Pending approvals">
        {approvals.map((approval) => (
          <li key={approval.id} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {approval.missionTitle}
                </p>
                <p className="text-xs text-slate-400">
                  Assigned to {approval.approver}
                </p>
              </div>
              <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-200">
                Due {new Date(approval.dueAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-300">{approval.summary}</p>
            <div className="mt-4 flex justify-end">
              <Link
                href={`${APPROVE_ROUTE}?approval=${approval.id}`}
                className="rounded-full border border-slate-800 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-100"
                onClick={() => onApprovalNavigate?.(approval)}
              >
                Review request
              </Link>
            </div>
          </li>
        ))}
        {approvals.length === 0 && (
          <li className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 text-sm text-slate-400">
            No pending approvals. Great job keeping the queue clear.
          </li>
        )}
      </ul>
    </section>
  );
}
