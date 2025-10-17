import { HomeDashboardData } from "../types/mission";

// Placeholder data reflecting docs/03_user_experience.md Stage 0 wireframe.
export async function getHomeDashboardData(): Promise<HomeDashboardData> {
  return {
    missions: [
      {
        id: "mission-q4-reactivation",
        title: "Q4 Reactivation",
        stage: "plan",
        owner: "Riley Patterson",
        readiness: "ready",
        nextAction: "Review ranked plays",
        updatedAt: "2025-10-15T18:32:00.000Z",
      },
      {
        id: "mission-support-surge",
        title: "Support Surge",
        stage: "prepare",
        owner: "Sam Torres",
        readiness: "needs-auth",
        nextAction: "Finalize Zendesk OAuth",
        updatedAt: "2025-10-15T17:12:00.000Z",
      },
      {
        id: "mission-compliance-sweep",
        title: "Compliance Sweep",
        stage: "execute",
        owner: "Gabriela Ortiz",
        readiness: "needs-data",
        nextAction: "Upload evidence hashes",
        updatedAt: "2025-10-15T16:05:00.000Z",
      },
      {
        id: "mission-platform-hardening",
        title: "Platform Hardening",
        stage: "reflect",
        owner: "Devon Shah",
        readiness: "blocked",
        nextAction: "Resolve validator escalation",
        updatedAt: "2025-10-14T23:59:00.000Z",
      },
    ],
    approvals: [
      {
        id: "approval-plan-8821",
        missionId: "mission-support-surge",
        missionTitle: "Support Surge",
        approver: "Gabriela Ortiz",
        dueAt: "2025-10-17T16:00:00.000Z",
        summary: "Authorize Zendesk triage play with escalation safeguards",
      },
      {
        id: "approval-plan-8822",
        missionId: "mission-platform-hardening",
        missionTitle: "Platform Hardening",
        approver: "Devon Shah",
        dueAt: "2025-10-16T21:00:00.000Z",
        summary: "Sign off validator override for Vercel deploy token refresh",
      },
    ],
    library: [
      {
        id: "library-reactivation",
        title: "Revenue Reactivation Sprint",
        description: "Re-engage dormant pipeline with personalized outreach and KPI guardrails.",
        timeToValueHours: 4,
        recommendedSafeguards: ["Respect opt-out lists", "Limit send volume to 250/day"],
      },
      {
        id: "library-support",
        title: "Support Surge Stabilizer",
        description: "Spin up templated responses, prioritize VIP queues, and surface high-risk tickets.",
        timeToValueHours: 3,
        recommendedSafeguards: ["Escalate security mentions", "Respect 2-hour SLA"],
      },
      {
        id: "library-release",
        title: "Release Hardening Sprint",
        description: "Coordinate hotfix validation, telemetry audits, and post-release follow ups.",
        timeToValueHours: 6,
        recommendedSafeguards: ["PagerDuty override in place", "Rollback plan approved"],
      },
      {
        id: "library-audit",
        title: "Audit Evidence Sync",
        description: "Verify evidence hashes, confirm policy coverage, and prepare compliance export.",
        timeToValueHours: 5,
        recommendedSafeguards: ["Hash integrity check", "Dual approver required"],
      },
    ],
    outcomes: [
      {
        id: "outcome-1",
        missionTitle: "Revenue Recovery Sprint",
        impact: "+$1.2M ARR",
        timeSavedHours: 42,
        owner: "Riley Patterson",
        completedAt: "2025-10-12T18:00:00.000Z",
        summary: "Automated follow-ups lifted win rate 18% after safeguard-tuned outreach.",
      },
      {
        id: "outcome-2",
        missionTitle: "Incident Containment",
        impact: "-37% MTTR",
        timeSavedHours: 18,
        owner: "Devon Shah",
        completedAt: "2025-10-10T11:30:00.000Z",
        summary: "Validator-driven guardrails kept customer impact under 0.2%.",
      },
    ],
    alerts: [
      {
        id: "alert-1",
        missionId: "mission-platform-hardening",
        message: "Validator escalation pending: confirm Vercel deploy override.",
        severity: "critical",
        nextStep: "Review escalation",
        href: "/workspace/plan",
      },
      {
        id: "alert-2",
        missionId: "mission-compliance-sweep",
        message: "Evidence hashes lagging 12 hours behind policy schedule.",
        severity: "warning",
        nextStep: "Open evidence checklist",
        href: "/workspace/reflect",
      },
      {
        id: "alert-3",
        missionId: "mission-support-surge",
        message: "Zendesk OAuth expires in 90 minutes.",
        severity: "info",
        nextStep: "Refresh credential",
        href: "/workspace/prepare",
      },
    ],
  };
}
