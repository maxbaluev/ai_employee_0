export type MissionStage =
  | "define"
  | "prepare"
  | "plan"
  | "approve"
  | "execute"
  | "reflect";

export type Persona = "RevOps" | "Support" | "Engineering" | "Governance";

export type ReadinessState = "ready" | "needs-auth" | "needs-data" | "blocked";

export interface MissionSummary {
  id: string;
  title: string;
  stage: MissionStage;
  owner: string;
  persona: Persona;
  readiness: ReadinessState;
  nextAction: string;
  updatedAt: string;
}

export interface MissionApproval {
  id: string;
  missionId: string;
  missionTitle: string;
  approver: string;
  dueAt: string;
  summary: string;
}

export type ApprovalStatus = "requested" | "delegated" | "approved" | "rejected" | "expired";

export interface ApprovalSummary {
  whatWillHappen: string;
  whoIsAffected: {
    recordCount: number;
    segments: string[];
    dataSources: string[];
  };
  safeguards: {
    id: string;
    category: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
  }[];
  undoPlan: {
    id: string;
    label: string;
    impactSummary: string;
    windowMinutes: number;
    steps: string[];
  };
  requiredPermissions: {
    toolkit: string;
    scopes: string[];
  }[];
}

export interface ApprovalHistoryEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: "requested" | "delegated" | "approved" | "rejected" | "commented";
  note?: string;
}

export interface ApprovalComment {
  id: string;
  author: string;
  authorRole: string;
  content: string;
  timestamp: string;
}

export interface ApprovalWorkspaceData {
  approval: {
    id: string;
    missionId: string;
    missionTitle: string;
    playId: string | null;
    status: ApprovalStatus;
    approverRole: string;
    approverId: string | null;
    rationale: string | null;
    dueAt: string | null;
    createdAt: string;
    decisionAt: string | null;
  };
  summary: ApprovalSummary;
  history: ApprovalHistoryEntry[];
  comments: ApprovalComment[];
}

export interface MissionTemplate {
  id: string;
  persona: Persona;
  title: string;
  description: string;
  timeToValueHours: number;
  recommendedSafeguards: string[];
}

export interface MissionTemplateGroup {
  persona: Persona;
  templates: MissionTemplate[];
}

export interface MissionOutcome {
  id: string;
  missionTitle: string;
  impact: string;
  timeSavedHours: number;
  owner: string;
  completedAt: string;
  summary: string;
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface MissionAlert {
  id: string;
  missionId: string;
  message: string;
  severity: AlertSeverity;
  nextStep: string;
  href: string;
}

export interface HomeDashboardData {
  missions: MissionSummary[];
  approvals: MissionApproval[];
  library: MissionTemplateGroup[];
  outcomes: MissionOutcome[];
  alerts: MissionAlert[];
}
