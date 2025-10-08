import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@supabase/types";

export async function getRouteHandlerSupabaseClient() {
  const cookieStore = await cookies();

  return createRouteHandlerClient<Database>({
    // Next.js 15 requires awaiting `cookies()` at call sites; cache the resolved
    // store so Supabase's helper still receives a synchronous accessor.
    cookies: (() => cookieStore) as unknown as () => ReturnType<typeof cookies>,
  });
}
