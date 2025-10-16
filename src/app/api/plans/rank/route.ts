import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));

  // TODO: call PlannerAgent for play ranking and ValidatorAgent for safeguard
  // enforcement. Align with mission lifecycle stage guidance in
  // docs/03a_chat_experience.md and docs/04_implementation_guide.md.

  return NextResponse.json(
    {
      status: "not_implemented",
      detail: "PlannerAgent integration pending",
      received: payload,
    },
    { status: 501 },
  );
}
