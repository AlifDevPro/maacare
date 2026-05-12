import { NextRequest } from "next/server";
import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

const bodySchema = z.object({
  status: z.enum(["visible", "hidden", "pending"]),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to moderate.");

    const parsedId = uuid.safeParse((await context.params).postId);
    if (!parsedId.success) return failJson(400, "Invalid post.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("community_set_post_moderation_status", {
      p_post_id: parsedId.data,
      p_status: parsed.data.status,
    });

    if (error) {
      console.error("[community/post moderate]", error);
      const msg = error.message.toLowerCase();
      if (msg.includes("forbidden")) return failJson(403, "Moderator access required.");
      return failJson(500, "Could not update post.");
    }

    if (data !== true) {
      return failJson(404, "Post not found.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("community_post moderate POST", e);
  }
}
