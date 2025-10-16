import type { MissionApprovalRow } from "@/lib/server/mission-approvals-repository";

export interface ApprovalResponse {
  id: string;
  missionId: string;
  missionPlayId: string | null;
  approverRole: string;
  approverId: string | null;
  status: MissionApprovalRow["status"];
  rationale: string | null;
  dueAt: string | null;
  decisionAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export function toApprovalResponse(
  row: MissionApprovalRow,
): ApprovalResponse {
  return {
    id: row.id,
    missionId: row.mission_id,
    missionPlayId: row.mission_play_id,
    approverRole: row.approver_role,
    approverId: row.approver_id,
    status: row.status,
    rationale: row.rationale,
    dueAt: row.due_at,
    decisionAt: row.decision_at,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
