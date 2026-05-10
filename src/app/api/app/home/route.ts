import { NextRequest } from "next/server";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getHomeData } from "@/lib/app/home-data";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const supabase = await createSupabaseServerClient();
    const home = await getHomeData(supabase, session.id, session.name ?? "Member");
    return Response.json(home);
  } catch (e) {
    return serverErrorJson("app_home GET", e);
  }
}

