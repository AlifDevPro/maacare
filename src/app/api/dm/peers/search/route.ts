import { NextRequest } from "next/server";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { escapeIlike } from "@/lib/community/aggregate-counts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) {
      return Response.json({ peers: [] });
    }

    const esc = escapeIlike(q);
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .neq("id", session.id)
      .ilike("display_name", `%${esc}%`)
      .order("display_name", { ascending: true })
      .limit(15);

    if (error) {
      console.error("[dm/peers/search GET]", error);
      return failJson(500, "Could not search members.");
    }

    const peers = (data ?? []).map((p) => ({
      id: p.id as string,
      displayName: (p.display_name as string | null)?.trim() || "Member",
      avatarUrl: (p.avatar_url as string | null) ?? null,
    }));

    return Response.json({ peers });
  } catch (e) {
    return serverErrorJson("dm/peers/search GET", e);
  }
}
