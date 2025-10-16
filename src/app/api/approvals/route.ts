import { NextResponse } from "next/server";
import { z } from "zod";

import { createMissionApproval } from "@/lib/server/mission-approvals-repository";
import { emitServerTelemetry } from "@/lib/telemetry/server";

import { toApprovalResponse } from "./serializer";

const createApprovalSchema = z.object({
  missionId: z.string().uuid("missionId must be a valid UUID"),
  playId: z.string().uuid().optional().nullable(),
  approverRole: z.string().min(1, "approverRole is required"),
  dueAt: z.string().datetime().optional().nullable(),
  rationale: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  undoPlanId: z.string().uuid().optional().nullable(),
});

type CreateApprovalPayload = z.infer<typeof createApprovalSchema>;

function inferApprovalType(payload: CreateApprovalPayload) {
  return payload.playId ? "plan" : "safeguard";
}

export async function POST(request: Request) {
  let payload: CreateApprovalPayload;

  try {
    payload = createApprovalSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "invalid_request",
          message: "Invalid approval payload",
          details: error.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "invalid_json",
        message: "Request body must be valid JSON",
      },
      { status: 400 },
    );
  }

  try {
    const record = await createMissionApproval({
      missionId: payload.missionId,
      missionPlayId: payload.playId ?? null,
      approverRole: payload.approverRole,
      dueAt: payload.dueAt ?? null,
      rationale: payload.rationale ?? null,
      metadata: payload.metadata ?? {},
      undoPlanId: payload.undoPlanId ?? null,
    });

    // TODO: replace with mission-scoped notification delivery (email/Slack).
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info("[approvals] notification pending", {
        approvalId: record.id,
        approverRole: record.approver_role,
      });
    }

    emitServerTelemetry("approval_requested", {
      approval_type: inferApprovalType(payload),
      approver_role: record.approver_role,
      due_at: record.due_at,
      play_id: record.mission_play_id,
      mission_id: record.mission_id,
    });

    return NextResponse.json(toApprovalResponse(record), { status: 201 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[approvals] failed to create approval", error);
    }

    return NextResponse.json(
      {
        error: "internal_error",
        message: "Unable to create approval request",
      },
      { status: 500 },
    );
  }
}
