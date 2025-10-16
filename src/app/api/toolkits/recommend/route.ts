import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));

  // TODO: delegate to InspectorAgent for Composio discovery and readiness state
  // caching. Align with docs/02_system_overview.md (Inspector responsibilities)
  // and docs/10_composio.md for OAuth scope handling and caching windows.

  return NextResponse.json(
    {
      status: "not_implemented",
      detail: "Toolkit recommendations pending Composio integration",
      received: payload,
    },
    { status: 501 },
  );
}
