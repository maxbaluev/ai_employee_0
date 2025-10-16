import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));

  // TODO: persist mission feedback, propagate to EvidenceAgent, and update
  // readiness scores. Reference docs/05_capability_roadmap.md and
  // docs/06_data_intelligence.md for telemetry requirements.

  return NextResponse.json(
    {
      status: "not_implemented",
      detail: "Feedback capture pending",
      received: payload,
    },
    { status: 501 },
  );
}
