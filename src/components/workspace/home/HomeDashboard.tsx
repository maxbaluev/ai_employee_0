"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";

import { emitTelemetry } from "@/lib/telemetry/client";
import {
  HomeDashboardData,
  MissionAlert,
  MissionApproval,
  MissionSummary,
  MissionTemplate,
} from "@/lib/types/mission";

import {
  AlertRail,
  ApprovalsCard,
  MissionLibraryPanel,
  MissionList,
  RecentOutcomes,
} from ".";

type HomeDashboardProps = {
  data: HomeDashboardData;
};

export function HomeDashboard({ data }: HomeDashboardProps) {
  useEffect(() => {
    emitTelemetry("home_tile_opened", {
      missions_visible: data.missions.length,
      persona: data.missions.length > 0 ? "multi" : "unknown",
      filter_state: "all",
    });
  }, [data.missions.length]);

  const handleMissionSelect = useCallback((mission: MissionSummary) => {
    emitTelemetry("mission_list_action_taken", {
      action_type: "open",
      mission_id: mission.id,
      mission_stage: mission.stage,
      needs_attention: mission.readiness !== "ready",
    });
  }, []);

  const handleBadgeVisible = useCallback((mission: MissionSummary) => {
    emitTelemetry("readiness_badge_rendered", {
      mission_id: mission.id,
      badge_state: mission.readiness,
      blocking_reason:
        mission.readiness === "ready" ? undefined : mission.nextAction,
    });
  }, []);

  const handleApprovalNavigate = useCallback((approval: MissionApproval) => {
    emitTelemetry("mission_list_action_taken", {
      action_type: "approval",
      mission_id: approval.missionId,
      mission_stage: "approve",
      due_at: approval.dueAt,
    });
  }, []);

  const handleTemplateSelect = useCallback((template: MissionTemplate) => {
    emitTelemetry("mission_list_action_taken", {
      action_type: "library",
      template_id: template.id,
      mission_stage: "define",
      persona: template.persona,
    });
  }, []);

  const handleAlertsViewed = useCallback((alerts: MissionAlert[]) => {
    emitTelemetry("alert_rail_viewed", {
      alert_count: alerts.length,
      alert_types: alerts.map((alert) => alert.severity),
      time_to_first_view: 0,
    });
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-8 lg:flex-row lg:items-center">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
            Stage 0 · Home dashboard
          </p>
          <h1 className="text-3xl font-semibold text-slate-100">
            Stay ahead across every mission
          </h1>
          <p className="max-w-2xl text-sm text-slate-300">
            Scan active missions, approvals, and recent outcomes at a glance.
            Launch new work or jump back into the next stage with confidence.
          </p>
        </div>
        <Link
          href="/workspace/define"
          className="inline-flex items-center justify-center rounded-full border border-cyan-500/60 bg-cyan-500/20 px-5 py-2 text-sm font-medium text-cyan-100 shadow-lg shadow-cyan-500/10 transition hover:border-cyan-300 hover:bg-cyan-400/25"
        >
          New mission
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
        <div className="space-y-6">
          <MissionList
            missions={data.missions}
            onMissionSelect={handleMissionSelect}
            onBadgeVisible={handleBadgeVisible}
          />
          <RecentOutcomes outcomes={data.outcomes} />
        </div>
        <div className="space-y-6">
          <ApprovalsCard
            approvals={data.approvals}
            onApprovalNavigate={handleApprovalNavigate}
          />
          <MissionLibraryPanel
            groups={data.library}
            onTemplateSelect={handleTemplateSelect}
          />
          <AlertRail alerts={data.alerts} onAlertsViewed={handleAlertsViewed} />
        </div>
      </div>
    </div>
  );
}
