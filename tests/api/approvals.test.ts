import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/mission-approvals-repository", () => ({
  createMissionApproval: vi.fn(),
  findMissionApprovalById: vi.fn(),
  updateMissionApproval: vi.fn(),
}));

vi.mock("@/lib/telemetry/server", () => ({
  emitServerTelemetry: vi.fn(),
}));

import { POST } from "@/app/api/approvals/route";
import { GET, PATCH } from "@/app/api/approvals/[id]/route";
import * as missionApprovals from "@/lib/server/mission-approvals-repository";
import { emitServerTelemetry } from "@/lib/telemetry/server";

type MissionApprovalRow = missionApprovals.MissionApprovalRow;

const createMissionApprovalMock = vi.mocked(missionApprovals.createMissionApproval);
const findMissionApprovalByIdMock = vi.mocked(
  missionApprovals.findMissionApprovalById,
);
const updateMissionApprovalMock = vi.mocked(
  missionApprovals.updateMissionApproval,
);
const emitServerTelemetryMock = vi.mocked(emitServerTelemetry);

const baseApproval: MissionApprovalRow = {
  id: "550e8400-e29b-41d4-a716-446655440099",
  mission_id: "550e8400-e29b-41d4-a716-446655440000",
  mission_play_id: "550e8400-e29b-41d4-a716-446655440001",
  approver_role: "governance_lead",
  approver_id: null,
  status: "requested",
  rationale: null,
  due_at: "2025-10-17T12:00:00.000Z",
  decision_at: null,
  metadata: { priority: "high" },
  created_at: "2025-10-16T11:00:00.000Z",
  updated_at: "2025-10-16T11:00:00.000Z",
  undo_plan_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/approvals", () => {
  it("creates a new approval and emits telemetry", async () => {
    createMissionApprovalMock.mockResolvedValue({
      ...baseApproval,
      rationale: "Requires governance review",
    });

    const response = await POST(
      new Request("http://localhost/api/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          missionId: baseApproval.mission_id,
          playId: baseApproval.mission_play_id,
          approverRole: baseApproval.approver_role,
          dueAt: baseApproval.due_at,
          rationale: "Requires governance review",
          metadata: { priority: "high" },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createMissionApprovalMock).toHaveBeenCalledWith({
      missionId: baseApproval.mission_id,
      missionPlayId: baseApproval.mission_play_id,
      approverRole: baseApproval.approver_role,
      dueAt: baseApproval.due_at,
      rationale: "Requires governance review",
      metadata: { priority: "high" },
      undoPlanId: null,
    });
    expect(emitServerTelemetryMock).toHaveBeenCalledWith(
      "approval_requested",
      expect.objectContaining({
        approver_role: baseApproval.approver_role,
        play_id: baseApproval.mission_play_id,
        mission_id: baseApproval.mission_id,
      }),
    );
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approverRole: "governance" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createMissionApprovalMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/approvals/:id", () => {
  it("returns 400 for invalid id", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: { id: "not-a-uuid" },
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 when approval is missing", async () => {
    findMissionApprovalByIdMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), {
      params: { id: baseApproval.id },
    });

    expect(response.status).toBe(404);
  });

  it("returns the approval payload when found", async () => {
    findMissionApprovalByIdMock.mockResolvedValue(baseApproval);

    const response = await GET(new Request("http://localhost"), {
      params: { id: baseApproval.id },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      id: baseApproval.id,
      missionId: baseApproval.mission_id,
      approverRole: baseApproval.approver_role,
    });
  });
});

describe("PATCH /api/approvals/:id", () => {
  it("requires actor role header", async () => {
    findMissionApprovalByIdMock.mockResolvedValue(baseApproval);

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      }),
      { params: { id: baseApproval.id } },
    );

    expect(response.status).toBe(403);
    expect(updateMissionApprovalMock).not.toHaveBeenCalled();
  });

  it("rejects role mismatches", async () => {
    findMissionApprovalByIdMock.mockResolvedValue(baseApproval);

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-actor-role": "different-role",
        },
        body: JSON.stringify({ status: "approved" }),
      }),
      { params: { id: baseApproval.id } },
    );

    expect(response.status).toBe(403);
    expect(updateMissionApprovalMock).not.toHaveBeenCalled();
  });

  it("requires rationale when rejecting", async () => {
    findMissionApprovalByIdMock.mockResolvedValue(baseApproval);

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-actor-role": baseApproval.approver_role,
        },
        body: JSON.stringify({ status: "rejected" }),
      }),
      { params: { id: baseApproval.id } },
    );

    expect(response.status).toBe(400);
    expect(updateMissionApprovalMock).not.toHaveBeenCalled();
  });

  it("approves an approval and emits telemetry", async () => {
    const approvedRecord: MissionApprovalRow = {
      ...baseApproval,
      status: "approved",
      rationale: "Looks good",
      decision_at: "2025-10-16T12:00:00.000Z",
      approver_id: "actor-1",
      updated_at: "2025-10-16T12:00:00.000Z",
    };

    findMissionApprovalByIdMock.mockResolvedValue(baseApproval);
    updateMissionApprovalMock.mockResolvedValue(approvedRecord);

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-actor-role": baseApproval.approver_role,
          "x-actor-id": "actor-1",
        },
        body: JSON.stringify({ status: "approved", rationale: "Looks good" }),
      }),
      { params: { id: baseApproval.id } },
    );

    expect(response.status).toBe(200);
    expect(updateMissionApprovalMock).toHaveBeenCalledTimes(1);
    expect(emitServerTelemetryMock).toHaveBeenCalledWith(
      "approval_granted",
      expect.objectContaining({
        approver_role: approvedRecord.approver_role,
        mission_id: approvedRecord.mission_id,
      }),
    );
  });

  it("rejects an approval and emits telemetry", async () => {
    const rejectedRecord: MissionApprovalRow = {
      ...baseApproval,
      status: "rejected",
      rationale: "Missing safeguards",
      decision_at: "2025-10-16T12:00:00.000Z",
      approver_id: "actor-1",
      updated_at: "2025-10-16T12:00:00.000Z",
    };

    findMissionApprovalByIdMock.mockResolvedValue(baseApproval);
    updateMissionApprovalMock.mockResolvedValue(rejectedRecord);

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-actor-role": baseApproval.approver_role,
        },
        body: JSON.stringify({
          status: "rejected",
          rationale: "Missing safeguards",
        }),
      }),
      { params: { id: baseApproval.id } },
    );

    expect(response.status).toBe(200);
    expect(emitServerTelemetryMock).toHaveBeenCalledWith(
      "approval_rejected",
      expect.objectContaining({
        mission_id: rejectedRecord.mission_id,
        feedback_note: rejectedRecord.rationale,
      }),
    );
    expect(emitServerTelemetryMock).toHaveBeenCalledWith(
      "audit_event_recorded",
      expect.objectContaining({
        mission_id: rejectedRecord.mission_id,
        approval_id: rejectedRecord.id,
      }),
    );
  });
});
