import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";

type ArtifactPayload = {
  artifact_id: string;
  title: string;
  summary: string;
  status?: string;
  evidence_hash?: string | null;
  checksum?: string | null;
  hash?: string | null;
};

type ExportRequest = {
  artifact?: ArtifactPayload;
  format?: "csv" | "pdf";
};

export const runtime = "nodejs";

function createCsv(artifact: ArtifactPayload): string {
  const hash = artifact.evidence_hash ?? artifact.checksum ?? artifact.hash ?? null;
  const headers = ["Artifact ID", "Title", "Status", "Evidence Hash", "Summary"];
  const values = [
    artifact.artifact_id,
    artifact.title,
    artifact.status ?? "unknown",
    hash ?? "",
    artifact.summary,
  ];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return `${headers.join(",")}\n${values.map(escape).join(",")}`;
}

async function createPdfBuffer(artifact: ArtifactPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    const hash = artifact.evidence_hash ?? artifact.checksum ?? artifact.hash ?? null;

    doc.on("data", (chunk: Buffer) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    doc.on("error", (error: unknown) => {
      reject(error);
    });

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    doc.fontSize(20).text(artifact.title, { underline: true, lineGap: 8 });
    doc.moveDown();
    doc
      .fontSize(12)
      .text(`Artifact ID: ${artifact.artifact_id}`)
      .moveDown(0.5)
      .text(`Status: ${artifact.status ?? "unknown"}`);
    if (hash) {
      doc.moveDown(0.75);
      doc.fontSize(11).text("Evidence Hash (SHA-256)", { underline: true });
      doc.moveDown(0.35);
      doc.fontSize(10).text(hash, { width: 500 });
    }
    doc.moveDown();
    doc.fontSize(12).text("Summary", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(artifact.summary, { align: "left" });

    doc.end();
  });
}

export async function POST(request: NextRequest) {
  let body: ExportRequest | null = null;
  try {
    body = (await request.json()) as ExportRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid export payload" },
      { status: 400 },
    );
  }

  if (!body?.artifact || !body.format) {
    return NextResponse.json(
      { error: "Missing artifact or format" },
      { status: 400 },
    );
  }

  const artifact = body.artifact;
  const fileBase = `artifact-${artifact.artifact_id}`;

  if (body.format === "csv") {
    const csv = createCsv(artifact);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${fileBase}.csv\"`,
        "Content-Length": Buffer.byteLength(csv, "utf8").toString(),
      },
    });
  }

  if (body.format === "pdf") {
    try {
      const pdfBuffer = await createPdfBuffer(artifact);
      const pdfBytes = new Uint8Array(pdfBuffer);
      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=\"${fileBase}.pdf\"`,
          "Content-Length": pdfBuffer.length.toString(),
        },
      });
    } catch (error) {
      console.error("Failed to generate PDF", error);
      return NextResponse.json(
        { error: "Unable to generate PDF" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: "Unsupported format" },
    { status: 400 },
  );
}
