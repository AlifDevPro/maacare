import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import {
  activatePremiumSubscription,
  adminResetSubscriptionToFree,
  getSubscriptionView,
} from "@/lib/subscription/repository";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

const uuid = z.string().uuid();

const patchSchema = z.object({
  action: z.enum(["grant_premium", "reset_free"]),
});

export async function GET(_req: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const parsedId = uuid.safeParse((await context.params).userId);
    if (!parsedId.success) return failJson(400, "Invalid user.");

    const svc = tryCreateSupabaseServiceClient();
    if (!svc) {
      return failJson(503, "Server missing SUPABASE_SERVICE_ROLE_KEY.");
    }

    const subscription = await getSubscriptionView(svc, parsedId.data);
    return Response.json({ subscription });
  } catch (e) {
    return serverErrorJson("admin/users/subscription GET", e);
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const parsedId = uuid.safeParse((await context.params).userId);
    if (!parsedId.success) return failJson(400, "Invalid user.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const svc = tryCreateSupabaseServiceClient();
    if (!svc) {
      return failJson(503, "Server missing SUPABASE_SERVICE_ROLE_KEY.");
    }

    const userId = parsedId.data;
    const subscription =
      parsed.data.action === "grant_premium"
        ? await activatePremiumSubscription(svc, userId)
        : await adminResetSubscriptionToFree(svc, userId);

    return Response.json({ ok: true, subscription });
  } catch (e) {
    return serverErrorJson("admin/users/subscription PATCH", e);
  }
}
