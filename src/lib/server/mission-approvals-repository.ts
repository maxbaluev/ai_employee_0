import type { Database } from "@supabase/types";

import type {
  ApprovalComment,
  ApprovalHistoryEntry,
  ApprovalSummary,
} from "@/lib/types/mission";

import { getServiceSupabaseClient } from "./supabase";

export type MissionApprovalRow =
  Database["public"]["Tables"]["mission_approvals"]["Row"];
type MissionApprovalInsert =
  Database["public"]["Tables"]["mission_approvals"]["Insert"];
type MissionApprovalUpdate =
  Database["public"]["Tables"]["mission_approvals"]["Update"];
type ApprovalStatus = Database["public"]["Enums"]["approval_status"];

export interface MissionApprovalMetadata {
  summary?: ApprovalSummary;
  history?: ApprovalHistoryEntry[];
  comments?: ApprovalComment[];
}

const EMPTY_METADATA: MissionApprovalMetadata = {
  history: [],
  comments: [],
};

export interface DelegateMissionApprovalInput {
  toRole: string;
  reason: string;
  delegatedByRole: string;
  delegatedById?: string | null;
}

export interface AddMissionApprovalCommentInput {
  author: string;
  authorRole: string;
  content: string;
}

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
    metadata: mergeMetadata(input.metadata ?? {}),
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

export function parseMissionApprovalMetadata(
  row: MissionApprovalRow,
): MissionApprovalMetadata {
  if (!row.metadata || typeof row.metadata !== "object" || Array.isArray(row.metadata)) {
    return { ...EMPTY_METADATA };
  }

  const metadata = row.metadata as Record<string, unknown>;

  return {
    summary: isApprovalSummary(metadata.summary) ? metadata.summary : undefined,
    history: Array.isArray(metadata.history)
      ? (metadata.history.filter(isHistoryEntry) as ApprovalHistoryEntry[])
      : [...EMPTY_METADATA.history!],
    comments: Array.isArray(metadata.comments)
      ? (metadata.comments.filter(isComment) as ApprovalComment[])
      : [...EMPTY_METADATA.comments!],
  };
}

export async function delegateMissionApproval(
  id: string,
  input: DelegateMissionApprovalInput,
): Promise<MissionApprovalRow> {
  const client = getServiceSupabaseClient();
  const approval = await findMissionApprovalById(id);

  if (!approval) {
    throw new Error(`Approval ${id} not found`);
  }

  const metadata = parseMissionApprovalMetadata(approval);
  const timestamp = new Date().toISOString();

  const historyEntry: ApprovalHistoryEntry = {
    id: `delegate-${Date.now()}`,
    action: "delegated",
    actor: input.delegatedByRole,
    actorRole: input.delegatedByRole,
    note: input.reason,
    timestamp,
  };

  metadata.history = [historyEntry, ...(metadata.history ?? [])];

  const { data, error } = await client
    .from("mission_approvals")
    .update({
      approver_role: input.toRole,
      status: "delegated",
      metadata,
      updated_at: timestamp,
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to delegate mission approval: ${error?.message ?? "unknown error"}`,
    );
  }

  return data;
}

export async function addMissionApprovalComment(
  id: string,
  input: AddMissionApprovalCommentInput,
): Promise<ApprovalComment> {
  const client = getServiceSupabaseClient();
  const approval = await findMissionApprovalById(id);

  if (!approval) {
    throw new Error(`Approval ${id} not found`);
  }

  const metadata = parseMissionApprovalMetadata(approval);
  const timestamp = new Date().toISOString();
  const comment: ApprovalComment = {
    id: `comment-${Date.now()}`,
    author: input.author,
    authorRole: input.authorRole,
    content: input.content,
    timestamp,
  };

  metadata.comments = [comment, ...(metadata.comments ?? [])];

  const { error } = await client
    .from("mission_approvals")
    .update({
      metadata,
      updated_at: timestamp,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to store approval comment: ${error.message}`);
  }

  return comment;
}

export async function appendApprovalHistory(
  id: string,
  entry: ApprovalHistoryEntry,
): Promise<void> {
  const client = getServiceSupabaseClient();
  const approval = await findMissionApprovalById(id);

  if (!approval) {
    throw new Error(`Approval ${id} not found`);
  }

  const metadata = parseMissionApprovalMetadata(approval);
  metadata.history = [entry, ...(metadata.history ?? [])];

  const { error } = await client
    .from("mission_approvals")
    .update({
      metadata,
      updated_at: entry.timestamp,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to append approval history: ${error.message}`);
  }
}

function mergeMetadata(raw: MissionApprovalInsert["metadata"]): MissionApprovalMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...EMPTY_METADATA };
  }

  const metadata = raw as Record<string, unknown>;

  return {
    summary: isApprovalSummary(metadata.summary) ? metadata.summary : undefined,
    history: Array.isArray(metadata.history)
      ? (metadata.history.filter(isHistoryEntry) as ApprovalHistoryEntry[])
      : [...EMPTY_METADATA.history!],
    comments: Array.isArray(metadata.comments)
      ? (metadata.comments.filter(isComment) as ApprovalComment[])
      : [...EMPTY_METADATA.comments!],
  };
}

function isApprovalSummary(value: unknown): value is ApprovalSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as ApprovalSummary;
  return (
    typeof candidate.whatWillHappen === "string" &&
    typeof candidate.undoPlan?.label === "string" &&
    Array.isArray(candidate.requiredPermissions)
  );
}

function isHistoryEntry(value: unknown): value is ApprovalHistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as ApprovalHistoryEntry;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.action === "string" &&
    typeof candidate.actor === "string" &&
    typeof candidate.timestamp === "string"
  );
}

function isComment(value: unknown): value is ApprovalComment {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as ApprovalComment;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.author === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.timestamp === "string"
  );
}
