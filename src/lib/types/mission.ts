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
