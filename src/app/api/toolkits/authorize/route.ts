import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));

  // TODO: request mission-scoped OAuth connect links via Composio
  // `client.connected_accounts.initiate`. Follow planner flows documented in
  // docs/10_composio.md and docs/04_implementation_guide.md section 3.2.

  return NextResponse.json(
    {
      status: "not_implemented",
      detail: "Connect Link initiation pending PlannerAgent wiring",
      received: payload,
    },
    { status: 501 },
  );
}
