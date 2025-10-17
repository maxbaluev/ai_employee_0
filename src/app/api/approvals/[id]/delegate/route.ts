import { NextResponse } from "next/server";
import { z } from "zod";

import {
  delegateMissionApproval,
  findMissionApprovalById,
} from "@/lib/server/mission-approvals-repository";
import { emitServerTelemetry } from "@/lib/telemetry/server";

const paramsSchema = z.object({ id: z.string().uuid("approval id must be a UUID") });

const bodySchema = z.object({
  toRole: z.string().min(1, "delegation role is required"),
  reason: z.string().min(1, "reason is required"),
});

export async function POST(request: Request, context: { params: unknown }) {
  const paramsResult = paramsSchema.safeParse(context.params);

  if (!paramsResult.success) {
    return NextResponse.json(
      { error: "invalid_request", message: paramsResult.error.issues[0]?.message ?? "Invalid id" },
      { status: 400 },
    );
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "invalid_request", message: "Invalid delegation payload", details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const approval = await findMissionApprovalById(paramsResult.data.id);
  if (!approval) {
    return NextResponse.json(
      { error: "not_found", message: `Approval ${paramsResult.data.id} not found` },
      { status: 404 },
    );
  }

  try {
    const updated = await delegateMissionApproval(paramsResult.data.id, {
      toRole: payload.toRole,
      reason: payload.reason,
      delegatedByRole: request.headers.get("x-actor-role") ?? approval.approver_role,
      delegatedById: request.headers.get("x-actor-id"),
    });

    emitServerTelemetry("approval_delegated", {
      approval_id: updated.id,
      mission_id: updated.mission_id,
      from_role: approval.approver_role,
      to_role: updated.approver_role,
      reason: payload.reason,
    });

    return NextResponse.json(
      {
        approverRole: updated.approver_role,
        status: updated.status,
      },
      { status: 200 },
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[approvals] failed to delegate", error);
    }

    return NextResponse.json(
      { error: "internal_error", message: "Unable to delegate approval" },
      { status: 500 },
    );
  }
}
