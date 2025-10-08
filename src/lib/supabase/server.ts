import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@supabase/types";

export function getRouteHandlerSupabaseClient() {
  return createRouteHandlerClient<Database>({ cookies });
}
