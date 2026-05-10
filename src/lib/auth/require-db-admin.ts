import type { NextResponse } from "next/server";

import { failJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Confirms the signed-in user is an admin in the database (not only JWT snapshot). */
export async function requireDbAdmin(): Promise<
  | { ok: true; userId: string; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> }
  | { ok: false; response: NextResponse }
> {
  const session = await getSessionFromCookies();
  if (!session) {
    return { ok: false, response: failJson(401, "Sign in.") };
  }

  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.id)
    .maybeSingle();

  if (error || row?.role !== "admin") {
    return { ok: false, response: failJson(403, "Admin access required.") };
  }

  return { ok: true, userId: session.id, supabase };
}
