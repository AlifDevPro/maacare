import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { isFcmClientConfigured } from "@/lib/push/firebase-config";
import { saveFcmSubscription } from "@/lib/push/save-subscription";

const bodySchema = z.object({
  token: z.string().min(1).max(4096),
  platform: z.enum(["web", "android", "ios"]).default("web"),
});

export async function POST(req: Request) {
  try {
    if (!isFcmClientConfigured()) {
      return failJson(
        503,
        "Push notifications are not configured. Add Firebase keys to the server environment.",
      );
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

    const ua = req.headers.get("user-agent")?.slice(0, 512) ?? null;

    const result = await saveFcmSubscription({
      userId: session.id,
      token: parsed.data.token,
      platform: parsed.data.platform,
      userAgent: ua,
    });

    if (!result.ok) {
      console.error("[push/subscribe]", result.code, result.message, result.hint);
      const dev = process.env.NODE_ENV === "development";
      const message = dev
        ? [result.message, result.hint].filter(Boolean).join(" — ")
        : "Could not save device token.";
      return failJson(500, message, dev ? { code: result.code } : undefined);
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("push/subscribe", e);
  }
}
