import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: { token?: string } },
) {
  const token = context.params?.token;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as {
      artifact: {
        artifact_id: string;
        title: string;
        summary: string;
        status?: string;
      };
      createdAt: string;
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to decode share token", error);
    return NextResponse.json({ error: "Invalid share token" }, { status: 400 });
  }
}
