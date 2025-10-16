import type { Database } from "@supabase/types";

import { getServiceSupabaseClient } from "./supabase";

export type MissionApprovalRow =
  Database["public"]["Tables"]["mission_approvals"]["Row"];
type MissionApprovalInsert =
  Database["public"]["Tables"]["mission_approvals"]["Insert"];
type MissionApprovalUpdate =
  Database["public"]["Tables"]["mission_approvals"]["Update"];
type ApprovalStatus = Database["public"]["Enums"]["approval_status"];

export interface CreateMissionApprovalInput {
  missionId: string;
  missionPlayId?: string | null;
  approverRole: string;
  dueAt?: string | null;
  rationale?: string | null;
  metadata?: MissionApprovalInsert["metadata"];
  undoPlanId?: string | null;
}

export interface UpdateMissionApprovalInput {
  status: Extract<ApprovalStatus, "approved" | "rejected">;
  rationale?: string | null;
  decisionAt: string;
  approverId?: string | null;
}

export async function createMissionApproval(
  input: CreateMissionApprovalInput,
): Promise<MissionApprovalRow> {
  const client = getServiceSupabaseClient();
  const payload: MissionApprovalInsert = {
    mission_id: input.missionId,
    mission_play_id: input.missionPlayId ?? null,
    approver_role: input.approverRole,
    due_at: input.dueAt ?? null,
    rationale: input.rationale ?? null,
    metadata: input.metadata ?? {},
    status: "requested",
    undo_plan_id: input.undoPlanId ?? null,
  };

  const { data, error } = await client
    .from("mission_approvals")
    .insert(payload)
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create mission approval: ${error?.message ?? "unknown error"}`,
    );
  }

  return data;
}

export async function findMissionApprovalById(
  id: string,
): Promise<MissionApprovalRow | null> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("mission_approvals")
    .select("*")
    .eq("id", id)
    .maybeSingle<MissionApprovalRow>();

  if (error) {
    throw new Error(`Failed to load mission approval: ${error.message}`);
  }

  return data;
}

export async function updateMissionApproval(
  id: string,
  patch: UpdateMissionApprovalInput,
): Promise<MissionApprovalRow> {
  const client = getServiceSupabaseClient();
  const payload: MissionApprovalUpdate = {
    status: patch.status,
    rationale: patch.rationale ?? null,
    decision_at: patch.decisionAt,
    approver_id: patch.approverId ?? null,
    updated_at: patch.decisionAt,
  };

  const { data, error } = await client
    .from("mission_approvals")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to update mission approval: ${error?.message ?? "unknown error"}`,
    );
  }

  return data;
}
