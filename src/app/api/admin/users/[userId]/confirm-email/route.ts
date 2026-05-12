import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

const uuid = z.string().uuid();

export async function POST(_req: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const parsedId = uuid.safeParse((await context.params).userId);
    if (!parsedId.success) return failJson(400, "Invalid user.");

    const svc = tryCreateSupabaseServiceClient();
    if (!svc) {
      return failJson(503, "Server missing SUPABASE_SERVICE_ROLE_KEY.");
    }

    const { error } = await svc.auth.admin.updateUserById(parsedId.data, {
      email_confirm: true,
    });

    if (error) {
      console.error("[admin/users/confirm-email]", error);
      return failJson(500, error.message ?? "Could not confirm email.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("admin/users/confirm-email POST", e);
  }
}
