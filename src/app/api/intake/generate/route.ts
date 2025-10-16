import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));

  // TODO: call IntakeAgent to generate or update mission briefs.
  // Reference docs/03_user_experience.md (Define stage) and
  // docs/04_implementation_guide.md section 3.1 for ADK orchestration details.

  return NextResponse.json(
    {
      status: "not_implemented",
      detail: "IntakeAgent integration pending",
      received: payload,
    },
    { status: 501 },
  );
}
