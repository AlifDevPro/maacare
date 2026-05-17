import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { removeFcmSubscription } from "@/lib/push/save-subscription";

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

    const result = await removeFcmSubscription(session.id, parsed.data.token);

    if (!result.ok) {
      console.error("[push/unsubscribe]", result.code, result.message);
      return failJson(500, "Could not remove device token.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("push/unsubscribe", e);
  }
}
