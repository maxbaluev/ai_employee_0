import { NextResponse } from "next/server";

type ShareRequest = {
  artifact?: {
    artifact_id: string;
    title: string;
    summary: string;
    status?: string;
  };
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: ShareRequest | null = null;
  try {
    body = (await request.json()) as ShareRequest;
  } catch {
    return NextResponse.json({ error: "Invalid share payload" }, { status: 400 });
  }

  if (!body?.artifact) {
    return NextResponse.json({ error: "Missing artifact" }, { status: 400 });
  }

  const artifact = body.artifact;

  const payload = Buffer.from(
    JSON.stringify({
      artifact,
      createdAt: new Date().toISOString(),
    }),
  ).toString("base64url");

  const url = new URL(request.url);
  const shareUrl = `${url.origin}/api/artifacts/share/${payload}`;

  return NextResponse.json({ shareUrl });
}
