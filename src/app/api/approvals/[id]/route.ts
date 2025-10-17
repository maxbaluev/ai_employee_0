import { NextResponse } from "next/server";
import { z } from "zod";

import {
  appendApprovalHistory,
  findMissionApprovalById,
  updateMissionApproval,
} from "@/lib/server/mission-approvals-repository";
import { emitServerTelemetry } from "@/lib/telemetry/server";

import { toApprovalResponse } from "../serializer";

const uuidSchema = z.string().uuid();

const updateApprovalSchema = z.object({
  status: z.enum(["approved", "rejected"], {
    errorMap: () => ({
      message: 'status must be either "approved" or "rejected"',
    }),
  }),
  rationale: z.string().optional().nullable(),
});

type UpdateApprovalPayload = z.infer<typeof updateApprovalSchema>;

function forbidden(message: string) {
  return NextResponse.json({ error: "forbidden", message }, { status: 403 });
}

function notFound(id: string) {
  return NextResponse.json(
    {
      error: "not_found",
      message: `Approval ${id} was not found`,
    },
    { status: 404 },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const idResult = uuidSchema.safeParse(params.id);
  if (!idResult.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "Approval id must be a UUID" },
      { status: 400 },
    );
  }

  try {
    const approval = await findMissionApprovalById(idResult.data);
    if (!approval) {
      return notFound(idResult.data);
    }

    return NextResponse.json(toApprovalResponse(approval));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[approvals] failed to load approval", error);
    }

    return NextResponse.json(
      { error: "internal_error", message: "Unable to load approval" },
      { status: 500 },
    );
  }
}

function validateRejectPayload(payload: UpdateApprovalPayload) {
  if (payload.status === "rejected" && !payload.rationale) {
    throw new z.ZodError([
      {
        path: ["rationale"],
        message: "rationale is required when rejecting an approval",
        code: z.ZodIssueCode.custom,
      },
    ]);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const idResult = uuidSchema.safeParse(params.id);
  if (!idResult.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "Approval id must be a UUID" },
      { status: 400 },
    );
  }

  let payload: UpdateApprovalPayload;
  try {
    payload = updateApprovalSchema.parse(await request.json());
    validateRejectPayload(payload);
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
      { error: "invalid_json", message: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const approval = await findMissionApprovalById(idResult.data).catch((error) => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[approvals] failed to load approval", error);
    }
    return undefined;
  });

  if (approval === undefined) {
    return NextResponse.json(
      { error: "internal_error", message: "Unable to load approval" },
      { status: 500 },
    );
  }

  if (!approval) {
    return notFound(idResult.data);
  }

  const actorRole = request.headers.get("x-actor-role")?.toLowerCase();
  if (!actorRole) {
    return forbidden("Missing X-Actor-Role header");
  }

  if (approval.approver_role.toLowerCase() !== actorRole) {
    return forbidden("Actor role is not authorized to decide this approval");
  }

  const decisionTimestamp = new Date().toISOString();

  let updatedApproval;
  try {
    updatedApproval = await updateMissionApproval(idResult.data, {
      status: payload.status,
      rationale: payload.rationale ?? approval.rationale ?? null,
      decisionAt: decisionTimestamp,
      approverId: request.headers.get("x-actor-id") ?? approval.approver_id,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[approvals] failed to update approval", error);
    }

    return NextResponse.json(
      { error: "internal_error", message: "Unable to update approval" },
      { status: 500 },
    );
  }

  if (payload.status === "approved") {
    emitServerTelemetry("approval_granted", {
      play_id: updatedApproval.mission_play_id,
      approver_role: updatedApproval.approver_role,
      approval_timestamp: updatedApproval.decision_at,
      mission_id: updatedApproval.mission_id,
    });
  } else {
    emitServerTelemetry("approval_rejected", {
      play_id: updatedApproval.mission_play_id,
      rejection_reason: "manual_review",
      feedback_note: updatedApproval.rationale,
      approver_role: updatedApproval.approver_role,
      mission_id: updatedApproval.mission_id,
    });
  }

  emitServerTelemetry("audit_event_recorded", {
    mission_id: updatedApproval.mission_id,
    approval_id: updatedApproval.id,
    approver_role: updatedApproval.approver_role,
    export_format: "mission_approvals_record",
  });

  try {
    await appendApprovalHistory(idResult.data, {
      id: `decision-${Date.now()}`,
      action: payload.status,
      actor: request.headers.get("x-actor-name") ?? updatedApproval.approver_role,
      actorRole: updatedApproval.approver_role,
      note: updatedApproval.rationale ?? undefined,
      timestamp: decisionTimestamp,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[approvals] failed to append history", error);
    }
  }

  return NextResponse.json(toApprovalResponse(updatedApproval));
}
