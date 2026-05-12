import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { sendBanNoticeEmail } from "@/lib/email/resend";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

const uuid = z.string().uuid();

const bodySchema = z.object({
  banned: z.boolean(),
  reason: z.string().max(2000).optional().nullable(),
  /** Supabase ban duration string, e.g. "876000h" (~100y) for indefinite-style ban. */
  banDuration: z.string().max(32).optional(),
});

export async function POST(req: Request, context: { params: Promise<{ userId: string }> }) {
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

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const svc = tryCreateSupabaseServiceClient();
    if (!svc) {
      return failJson(503, "Server missing SUPABASE_SERVICE_ROLE_KEY.");
    }

    const targetId = parsedId.data;
    const { banned, reason, banDuration } = parsed.data;

    if (parsedId.data === gate.userId && banned) {
      return failJson(400, "You cannot ban your own admin session.");
    }

    const { data: authBefore } = await svc.auth.admin.getUserById(targetId);
    const email = authBefore?.user?.email ?? null;

    const duration = banned ? (banDuration?.trim() || "876000h") : "none";

    const { error: authErr } = await svc.auth.admin.updateUserById(targetId, {
      ban_duration: banned ? duration : "none",
    });

    if (authErr) {
      console.error("[admin/users/ban] auth", authErr);
      return failJson(500, authErr.message ?? "Could not update ban state.");
    }

    const reasonTrim = reason?.trim() || null;
    await svc
      .from("profiles")
      .update({ ban_reason: banned ? reasonTrim : null })
      .eq("id", targetId);

    if (banned && email) {
      const { data: prof } = await svc.from("profiles").select("display_name").eq("id", targetId).maybeSingle();
      await sendBanNoticeEmail({
        to: email,
        displayName: prof?.display_name as string | undefined,
        reason: reasonTrim,
      });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("admin/users/ban POST", e);
  }
}
