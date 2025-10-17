import { NextResponse } from "next/server";
import { z } from "zod";

import {
  addMissionApprovalComment,
  findMissionApprovalById,
} from "@/lib/server/mission-approvals-repository";

const paramsSchema = z.object({ id: z.string().uuid("approval id must be a UUID") });

const bodySchema = z.object({
  content: z.string().min(1, "comment content is required"),
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
        { error: "invalid_request", message: "Invalid comment payload", details: error.issues },
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
    const comment = await addMissionApprovalComment(paramsResult.data.id, {
      author: request.headers.get("x-actor-name") ?? "Mission workspace",
      authorRole: request.headers.get("x-actor-role") ?? approval.approver_role,
      content: payload.content,
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[approvals] failed to store comment", error);
    }

    return NextResponse.json(
      { error: "internal_error", message: "Unable to store comment" },
      { status: 500 },
    );
  }
}
