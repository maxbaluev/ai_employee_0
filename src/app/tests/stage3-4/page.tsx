import { ControlPlaneWorkspace } from "@/app/(control-plane)/ControlPlaneWorkspace";

export const dynamic = "force-static";

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const TEST_MISSION_ID = "11111111-1111-1111-1111-111111111111";

export default function StageThreeFourTestHarness() {
  return (
    <ControlPlaneWorkspace
      tenantId={TEST_TENANT_ID}
      initialObjectiveId={TEST_MISSION_ID}
      initialArtifacts={[]}
      catalogSummary={{ total_entries: 0, toolkits: 0, categories: [] }}
    />
  );
}
