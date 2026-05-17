import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { isFcmConfigured } from "@/lib/push/firebase-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  token: z.string().min(1).max(4096),
  platform: z.enum(["web", "android", "ios"]).default("web"),
});

export async function POST(req: Request) {
  try {
    if (!isFcmConfigured()) {
      return failJson(503, "Push notifications are not configured on this server.");
    }

    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to enable notifications.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const ua = req.headers.get("user-agent")?.slice(0, 512) ?? null;

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: session.id,
        fcm_token: parsed.data.token,
        platform: parsed.data.platform,
        user_agent: ua,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "fcm_token" },
    );

    if (error) {
      console.error("[push/subscribe]", error);
      return failJson(500, "Could not save device token.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("push/subscribe", e);
  }
}
