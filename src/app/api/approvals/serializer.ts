import type { ApprovalComment, ApprovalHistoryEntry, ApprovalSummary } from "@/lib/types/mission";

import {
  parseMissionApprovalMetadata,
  type MissionApprovalRow,
} from "@/lib/server/mission-approvals-repository";

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
  missionTitle: string | null;
  summary: ApprovalSummary | null;
  history: ApprovalHistoryEntry[] | null;
  comments: ApprovalComment[] | null;
  createdAt: string;
  updatedAt: string;
}

export function toApprovalResponse(
  row: MissionApprovalRow,
): ApprovalResponse {
  const metadata = parseMissionApprovalMetadata(row);

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
    missionTitle: (row.metadata as Record<string, unknown> | null)?.missionTitle as
      | string
      | null
      | undefined ?? null,
    summary: metadata.summary ?? null,
    history: metadata.history ?? null,
    comments: metadata.comments ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
