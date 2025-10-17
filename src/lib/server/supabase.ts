import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../1database-generated.types";

let cachedClient: SupabaseClient<Database> | null = null;

function requireEnv(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

/**
 * Returns a Supabase client authenticated with the service role key.
 *
 * The service role client is only intended for trusted server-side code paths
 * (e.g. API routes) that need to bypass Row Level Security. Client-side code
 * should continue to use the user session aware helpers from
 * `@supabase/auth-helpers-nextjs` instead.
 */
export function getServiceSupabaseClient(): SupabaseClient<Database> {
  if (cachedClient) {
    return cachedClient;
  }

  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;

  if (!url) {
    throw new Error(
      "Missing required environment variable: set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL",
    );
  }
  const serviceRoleKey = requireEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  cachedClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}
