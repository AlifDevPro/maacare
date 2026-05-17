import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  token: z.string().min(1).max(4096),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", session.id)
      .eq("fcm_token", parsed.data.token);

    if (error) {
      console.error("[push/unsubscribe]", error);
      return failJson(500, "Could not remove device token.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("push/unsubscribe", e);
  }
}
