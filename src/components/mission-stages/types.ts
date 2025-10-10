/**
 * Mission stage types for the eight-stage Gate G-B flow.
 *
 * Flow: Intake → Brief → Toolkits → Inspect → Plan → DryRun → Evidence → Feedback
 */

export enum MissionStage {
  Intake = 'intake',
  Brief = 'brief',
  Toolkits = 'toolkits',
  Inspect = 'inspect',
  Plan = 'plan',
  DryRun = 'dry_run',
  Evidence = 'evidence',
  Feedback = 'feedback',
}

export const MISSION_STAGE_ORDER: MissionStage[] = [
  MissionStage.Intake,
  MissionStage.Brief,
  MissionStage.Toolkits,
  MissionStage.Inspect,
  MissionStage.Plan,
  MissionStage.DryRun,
  MissionStage.Evidence,
  MissionStage.Feedback,
];

export type MissionStageState = 'pending' | 'active' | 'completed' | 'failed';

export type MissionStageStatus = {
  stage: MissionStage;
  state: MissionStageState;
  startedAt: Date | null;
  completedAt: Date | null;
  locked: boolean;
  metadata?: Record<string, unknown>;
};

export type MissionStagesMap = Map<MissionStage, MissionStageStatus>;
