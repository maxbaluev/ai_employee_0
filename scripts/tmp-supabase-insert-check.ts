import type { TablesInsert } from "@supabase/types";

type MissionSafeguardsInsert = TablesInsert<"mission_safeguards">;

type Check = MissionSafeguardsInsert extends never ? true : false;
type Expect = Check extends true ? "never" : "ok";

const checkValue: Expect = "ok";

void checkValue;
