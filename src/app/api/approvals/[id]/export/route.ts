import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { z } from "zod";

import {
  findMissionApprovalById,
  parseMissionApprovalMetadata,
} from "@/lib/server/mission-approvals-repository";

const paramsSchema = z.object({ id: z.string().uuid("approval id must be a UUID") });

export async function GET(_request: Request, context: { params: unknown }) {
  const paramsResult = paramsSchema.safeParse(context.params);
  if (!paramsResult.success) {
    return NextResponse.json(
      { error: "invalid_request", message: paramsResult.error.issues[0]?.message ?? "Invalid id" },
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

  const metadata = parseMissionApprovalMetadata(approval);

  const doc = new PDFDocument({ margin: 48 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  doc
    .fontSize(18)
    .fillColor("#0f172a")
    .text("Approval Summary", { underline: true })
    .moveDown();

  doc
    .fontSize(12)
    .fillColor("#0f172a")
    .text(`Approval ID: ${approval.id}`)
    .text(`Mission ID: ${approval.mission_id}`)
    .text(`Approver role: ${approval.approver_role}`)
    .text(`Status: ${approval.status}`)
    .moveDown();

  if (metadata.summary) {
    doc.fontSize(14).text("What will happen", { continued: false }).fontSize(12).text(metadata.summary.whatWillHappen).moveDown();

    doc.fontSize(14).text("Who is affected");
    doc
      .fontSize(12)
      .text(`Records: ${metadata.summary.whoIsAffected.recordCount.toLocaleString()}`)
      .text(`Segments: ${metadata.summary.whoIsAffected.segments.join(", ")}`)
      .text(`Data sources: ${metadata.summary.whoIsAffected.dataSources.join(", ")}`)
      .moveDown();

    doc.fontSize(14).text("Safeguards");
    metadata.summary.safeguards.forEach((safeguard) => {
      doc
        .fontSize(12)
        .text(`• [${safeguard.severity}] ${safeguard.category}: ${safeguard.description}`);
    });

    doc.moveDown().fontSize(14).text("Undo plan");
    doc.fontSize(12).text(metadata.summary.undoPlan.label);
    doc.text(`Impact: ${metadata.summary.undoPlan.impactSummary}`);
    doc.text(`Window: ${metadata.summary.undoPlan.windowMinutes} minutes`);
    metadata.summary.undoPlan.steps.forEach((step, index) => {
      doc.text(`${index + 1}. ${step}`);
    });

    doc.moveDown().fontSize(14).text("Required permissions");
    metadata.summary.requiredPermissions.forEach((permission) => {
      doc.fontSize(12).text(`${permission.toolkit}: ${permission.scopes.join(", ")}`);
    });
  }

  if (metadata.history?.length) {
    doc.moveDown().fontSize(14).text("History");
    metadata.history.forEach((entry) => {
      doc
        .fontSize(12)
        .text(
          `${new Date(entry.timestamp).toLocaleString()} • ${entry.actor} (${entry.actorRole}) — ${entry.action}${
            entry.note ? ` — ${entry.note}` : ""
          }`,
        );
    });
  }

  if (metadata.comments?.length) {
    doc.moveDown().fontSize(14).text("Comments");
    metadata.comments.forEach((comment) => {
      doc
        .fontSize(12)
        .text(
          `${new Date(comment.timestamp).toLocaleString()} • ${comment.author} (${comment.authorRole})`,
        )
        .text(comment.content)
        .moveDown(0.5);
    });
  }

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on("end", () => resolve());
  });

  const pdfBuffer = Buffer.concat(chunks);

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="approval-${approval.id}.pdf"`,
    },
  });
}
