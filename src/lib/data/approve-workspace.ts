import type {
  ApprovalComment,
  ApprovalHistoryEntry,
  ApprovalSummary,
  ApprovalWorkspaceData,
} from "@/lib/types/mission";

const FALLBACK_SUMMARY: ApprovalSummary = {
  whatWillHappen: "Reach 83 manufacturing CFOs over three days with personalized reactivation outreach",
  whoIsAffected: {
    recordCount: 83,
    segments: ["Manufacturing CFOs", "Dormant >90 days", "High-value accounts"],
    dataSources: ["HubSpot", "Gmail"],
  },
  safeguards: [
    {
      id: "sg-1",
      category: "Rate limiting",
      description: "Limit outreach to 30 contacts per hour to avoid spam penalties",
      severity: "high",
    },
    {
      id: "sg-2",
      category: "PII protection",
      description: "Mask customer emails before logging evidence",
      severity: "critical",
    },
    {
      id: "sg-3",
      category: "Validator alerts",
      description: "Pause execution if validator raises a critical safeguard",
      severity: "medium",
    },
  ],
  undoPlan: {
    id: "undo-plan-1",
    label: "Rollback outreach",
    impactSummary: "Cancels unsent emails, restores task queues, and publishes an audit trail",
    windowMinutes: 15,
    steps: [
      "Cancel remaining email sends",
      "Notify account owners of rollback",
      "Generate rollback evidence bundle",
    ],
  },
  requiredPermissions: [
    {
      toolkit: "HubSpot",
      scopes: ["contacts.read", "contacts.write", "campaigns.send"],
    },
    {
      toolkit: "Gmail",
      scopes: ["gmail.compose", "gmail.send"],
    },
  ],
};

const FALLBACK_HISTORY: ApprovalHistoryEntry[] = [
  {
    id: "hist-requested",
    action: "requested",
    actor: "Riley Patterson",
    actorRole: "RevOps Lead",
    timestamp: "2025-10-16T17:11:00.000Z",
    note: "Generated play ready for governance review.",
  },
  {
    id: "hist-delegated",
    action: "delegated",
    actor: "Riley Patterson",
    actorRole: "RevOps Lead",
    timestamp: "2025-10-16T17:25:00.000Z",
    note: "Delegated to governance for scope confirmation.",
  },
];

const FALLBACK_COMMENTS: ApprovalComment[] = [
  {
    id: "comment-governance",
    author: "Gabriela Ortiz",
    authorRole: "Governance Officer",
    content: "Safeguards align with policy. Ensure validator escalation remains enabled.",
    timestamp: "2025-10-16T17:40:00.000Z",
  },
];

type ApprovalResponse = {
  id: string;
  missionId: string;
  missionTitle: string | null;
  missionPlayId: string | null;
  approverRole: string;
  approverId: string | null;
  status: string;
  rationale: string | null;
  dueAt: string | null;
  decisionAt: string | null;
  createdAt: string;
  updatedAt: string;
  summary?: ApprovalSummary | null;
  history?: ApprovalHistoryEntry[] | null;
  comments?: ApprovalComment[] | null;
};

type DelegateApprovalPayload = {
  toRole: string;
  reason: string;
};

type DelegateApprovalResponse = {
  approverRole: string;
  status: string;
};

export async function loadApprovalWorkspaceData(
  approvalId: string,
): Promise<ApprovalWorkspaceData> {
  const response = await fetch(`/api/approvals/${approvalId}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return buildFallbackWorkspace(approvalId);
    }

    throw new Error(`Failed to load approval (${response.statusText})`);
  }

  const data = (await response.json()) as ApprovalResponse;

  return {
    approval: {
      id: data.id,
      missionId: data.missionId,
      missionTitle: data.missionTitle ?? "Mission approval",
      playId: data.missionPlayId,
      status: normaliseApprovalStatus(data.status),
      approverRole: data.approverRole,
      approverId: data.approverId,
      rationale: data.rationale,
      dueAt: data.dueAt,
      createdAt: data.createdAt,
      decisionAt: data.decisionAt,
    },
    summary: data.summary ?? FALLBACK_SUMMARY,
    history: data.history && data.history.length > 0 ? data.history : FALLBACK_HISTORY,
    comments: data.comments && data.comments.length > 0 ? data.comments : FALLBACK_COMMENTS,
  };
}

export async function submitApprovalDecision(
  approvalId: string,
  decision: "approved" | "rejected",
  rationale?: string,
): Promise<void> {
  const response = await fetch(`/api/approvals/${approvalId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Actor-Role": "governance",
      "X-Actor-Id": "workspace-owner",
    },
    body: JSON.stringify({ status: decision, rationale }),
  });

  if (!response.ok) {
    const error = await safeParseError(response);
    throw new Error(error ?? `Failed to ${decision} approval`);
  }
}

export async function delegateApproval(
  approvalId: string,
  payload: DelegateApprovalPayload,
): Promise<DelegateApprovalResponse> {
  const response = await fetch(`/api/approvals/${approvalId}/delegate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await safeParseError(response);
    throw new Error(error ?? "Failed to delegate approval");
  }

  return (await response.json()) as DelegateApprovalResponse;
}

export async function addApprovalComment(
  approvalId: string,
  content: string,
): Promise<ApprovalComment> {
  const response = await fetch(`/api/approvals/${approvalId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await safeParseError(response);
    throw new Error(error ?? "Failed to post comment");
  }

  return (await response.json()) as ApprovalComment;
}

export async function exportApprovalToPDF(approvalId: string): Promise<void> {
  const response = await fetch(`/api/approvals/${approvalId}/export`, {
    method: "GET",
    headers: { Accept: "application/pdf" },
  });

  if (!response.ok) {
    const error = await safeParseError(response);
    throw new Error(error ?? "Failed to export approval summary");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `approval-${approvalId}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function safeParseError(response: Response): Promise<string | null> {
  try {
    const body = await response.json();
    if (typeof body?.message === "string") {
      return body.message;
    }
  } catch (error) {
    console.warn("[approve-workspace] failed to parse error payload", error);
  }

  return null;
}

function buildFallbackWorkspace(approvalId: string): ApprovalWorkspaceData {
  return {
    approval: {
      id: approvalId,
      missionId: "mission-demo",
      missionTitle: "Demo mission",
      playId: null,
      status: "requested",
      approverRole: "governance",
      approverId: null,
      rationale: null,
      dueAt: null,
      createdAt: new Date().toISOString(),
      decisionAt: null,
    },
    summary: FALLBACK_SUMMARY,
    history: FALLBACK_HISTORY,
    comments: FALLBACK_COMMENTS,
  };
}

function normaliseApprovalStatus(status: string): ApprovalWorkspaceData["approval"]["status"] {
  const allowed = new Set(["requested", "delegated", "approved", "rejected", "expired"]);
  return allowed.has(status) ? (status as ApprovalWorkspaceData["approval"]["status"]) : "requested";
}
