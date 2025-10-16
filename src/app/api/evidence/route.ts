import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const missionId = url.searchParams.get("missionId");

  // TODO: fetch evidence records from Supabase and EvidenceAgent cache.
  // Align with docs/04_implementation_guide.md section 4 and
  // docs/07_operations_playbook.md for retention requirements.

  return NextResponse.json(
    {
      status: "not_implemented",
      detail: "Evidence retrieval pending",
      missionId,
    },
    { status: 501 },
  );
}
