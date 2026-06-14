import { SupabaseClient, createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Client for browser-side operations (subject to RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations (bypasses RLS).
// Only use in API routes, never expose to client.
//
// Fail-fast in production: a missing service key means every "admin" call
// silently runs as the anon client and gets blocked by RLS (or worse, leaks
// the wrong scope). At runtime in production that's a hard error. During the
// Next.js build step (and in tests) the key may legitimately be absent, so we
// only throw when actually serving requests in production.
function resolveAdminClient(): SupabaseClient {
  if (supabaseServiceKey) {
    return createClient(supabaseUrl, supabaseServiceKey);
  }

  // Server-side without a service key.
  if (typeof window === "undefined") {
    const isProductionRuntime =
      process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";

    if (isProductionRuntime) {
      throw new Error(
        "[supabase] SUPABASE_SERVICE_ROLE_KEY is required in production. " +
          "Admin operations cannot fall back to the anon client (RLS would block them)."
      );
    }

    console.warn(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Admin operations will use anon client and may fail due to RLS policies."
    );
  }

  return supabase;
}

export const supabaseAdmin: SupabaseClient = resolveAdminClient();
