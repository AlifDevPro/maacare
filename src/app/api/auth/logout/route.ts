import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseAuthRouteHandler } from "@/lib/supabase/route-handler-client";

export async function POST(req: NextRequest) {
  const { supabase, applyAuthCookies } = createSupabaseAuthRouteHandler(req);
  await supabase.auth.signOut();
  return applyAuthCookies(NextResponse.json({ ok: true }));
}
