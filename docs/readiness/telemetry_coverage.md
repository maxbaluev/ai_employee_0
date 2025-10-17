# Telemetry Coverage Report

Generated: 2025-10-17T04:51:40.789Z

Total documented events: 48
Coverage: 56.3%

## Missing Events

- **composio_tool_call** (stage: Stage 5: Execute)
- **composio_tool_call_error** (stage: Stage 5: Execute)
- **coverage_preview_opened** (stage: Stage 2: Prepare)
- **evidence_opened** (stage: Stage 6: Reflect)
- **execution_started** (stage: Stage 5: Execute)
- **execution_step_completed** (stage: Stage 5: Execute)
- **feedback_submitted** (stage: Stage 6: Reflect)
- **followup_scheduled** (stage: Stage 6: Reflect)
- **governance_override_requested** (stage: Stage 2: Prepare)
- **incident_opened** (stage: Cross-Stage & Platform Events)
- **incident_resolved** (stage: Cross-Stage & Platform Events)
- **inspection_viewed** (stage: Cross-Stage & Platform Events)
- **library_contribution** (stage: Stage 6: Reflect)
- **mission_retrospective_logged** (stage: Stage 6: Reflect)
- **plan_adjusted** (stage: Stage 3: Plan)
- **session_heartbeat** (stage: Stage 5: Execute)
- **toolkit_connected** (stage: Stage 2: Prepare)
- **undo_available** (stage: Stage 5: Execute)
- **undo_completed** (stage: Stage 5: Execute)
- **undo_requested** (stage: Stage 5: Execute)
- **workspace_stream_open** (stage: Cross-Stage & Platform Events)

## Context Gaps

- /home/maxbaluev/ai_eployee_0/src/app/api/approvals/[id]/delegate/route.ts: missing [tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/app/api/approvals/[id]/route.ts: missing [tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/app/api/approvals/[id]/route.ts: missing [tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/app/api/approvals/[id]/route.ts: missing [tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/app/api/approvals/route.ts: missing [tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/app/api/intake/generate/route.ts: missing [stage]
- /home/maxbaluev/ai_eployee_0/src/app/api/intake/generate/route.ts: missing [stage]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/approve/ApprovalDecisionPanel.tsx: missing [tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/approve/ApprovalDecisionPanel.tsx: missing [tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/approve/ApprovalDecisionPanel.tsx: missing [tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/approve/ApprovalDecisionPanel.tsx: missing [tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/approve/ApprovalDecisionPanel.tsx: missing [tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/define/__tests__/DefineStage.test.tsx: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/define/__tests__/DefineStage.test.tsx: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/define/__tests__/DefineStage.test.tsx: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/home/HomeDashboard.tsx: missing [mission_id, tenantId, stage]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/home/HomeDashboard.tsx: missing [tenantId, persona]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/home/HomeDashboard.tsx: missing [tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/home/HomeDashboard.tsx: missing [tenantId, persona]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/home/HomeDashboard.tsx: missing [mission_id, tenantId]
- /home/maxbaluev/ai_eployee_0/src/components/workspace/home/HomeDashboard.tsx: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/hooks/useMissionIntake.ts: missing [stage, persona]
- /home/maxbaluev/ai_eployee_0/src/hooks/useMissionIntake.ts: missing [stage, persona]
- /home/maxbaluev/ai_eployee_0/src/hooks/useMissionIntake.ts: missing [persona]
- /home/maxbaluev/ai_eployee_0/src/hooks/useMissionIntake.ts: missing [stage]
- /home/maxbaluev/ai_eployee_0/src/hooks/useMissionIntake.ts: missing [stage]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/client.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/server.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/server.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/server.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/server.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/server.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/server.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/src/lib/telemetry/server.ts: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/coordinator.py: missing [mission_id, tenantId, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/inspector.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/inspector.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/inspector.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/inspector.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/inspector.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/inspector.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/inspector.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/inspector.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/inspector.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/inspector.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/intake.py: missing [mission_id, tenantId, stage]
- /home/maxbaluev/ai_eployee_0/agent/agents/intake.py: missing [mission_id, tenantId, stage]
- /home/maxbaluev/ai_eployee_0/agent/agents/intake.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/intake.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/planner.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/planner.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/planner.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/validator.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/validator.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/validator.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/validator.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/validator.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/validator.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/agents/validator.py: missing [mission_id, tenantId, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_inspector_agent.py: missing [mission_id, tenantId, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_inspector_agent.py: missing [mission_id, tenantId, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_inspector_agent.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_inspector_agent.py: missing [mission_id, tenantId, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_inspector_agent.py: missing [mission_id, tenantId, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_intake_agent.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_intake_agent.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_intake_agent.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_planner_agent.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_planner_agent.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_planner_agent.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_validator_agent.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_validator_agent.py: missing [mission_id, tenantId, stage, persona]
- /home/maxbaluev/ai_eployee_0/agent/tests/test_validator_agent.py: missing [mission_id, tenantId, stage, persona]

## Orphan Events (not documented)

- coordinator_error
- coordinator_handoff
- inspector_error
- intake_error
- mission_stage_transition
- planner_error
- planner_scope_validation
- validator_auto_fix_applied
