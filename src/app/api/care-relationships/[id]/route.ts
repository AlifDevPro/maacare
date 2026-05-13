import { NextResponse } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  action: z.enum(["accept", "revoke"]),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in required.");

    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const { data: row, error: fetchErr } = await supabase
      .from("care_relationships")
      .select("id, subject_user_id, viewer_user_id, invited_by_user_id, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return failJson(500, "Could not load invite.");
    if (!row) return failJson(404, "Not found.");
    if (row.subject_user_id !== session.id && row.viewer_user_id !== session.id) {
      return failJson(403, "Forbidden.");
    }

    const now = new Date().toISOString();

    if (parsed.data.action === "accept") {
      if (row.status !== "pending") return failJson(400, "This invite is not pending.");
      if (row.invited_by_user_id === session.id) {
        return failJson(400, "You cannot accept an invite you created.");
      }
      const { error } = await supabase
        .from("care_relationships")
        .update({ status: "active", accepted_at: now })
        .eq("id", id);
      if (error) return failJson(500, "Could not accept invite.");
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from("care_relationships")
      .update({ status: "revoked", revoked_at: now })
      .eq("id", id);
    if (error) return failJson(500, "Could not revoke link.");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SyntaxError) return failJson(400, "Invalid JSON.");
    return serverErrorJson("care-relationships/patch", err);
  }
}
