import { NextResponse } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { revalidateLandingTeamCache } from "@/lib/team/landing-team-members";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

const bodySchema = z.object({
  orderedUserIds: z.array(z.string().uuid()).min(1),
});

export async function POST(req: Request) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const svc = tryCreateSupabaseServiceClient();
    if (!svc) return failJson(503, "Server missing SUPABASE_SERVICE_ROLE_KEY.");

    const ids = parsed.data.orderedUserIds;
    const step = 10;
    for (let i = 0; i < ids.length; i++) {
      const userId = ids[i]!;
      const { error } = await svc
        .from("developer_team_profiles")
        .update({ sort_order: i * step })
        .eq("user_id", userId);
      if (error) {
        console.error("[reorder]", error);
        return failJson(500, "Could not apply order.");
      }
    }

    revalidateLandingTeamCache();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverErrorJson("developer_team_reorder", e);
  }
}
