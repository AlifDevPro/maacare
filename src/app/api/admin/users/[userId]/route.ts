import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

const uuid = z.string().uuid();
const patchSchema = z.object({
  role: z.enum(["user", "moderator", "admin"]),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ userId: string }> },
) {
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

    const targetId = parsedId.data;
    const newRole = parsed.data.role;

    const svc = tryCreateSupabaseServiceClient();
    if (!svc) {
      return failJson(
        503,
        "Server missing SUPABASE_SERVICE_ROLE_KEY — required to assign roles.",
      );
    }

    const { data: target, error: loadErr } = await svc
      .from("profiles")
      .select("role")
      .eq("id", targetId)
      .maybeSingle();

    if (loadErr || !target) {
      return failJson(404, "User not found.");
    }

    if (target.role === "admin" && newRole !== "admin") {
      const { count, error: cErr } = await svc
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");

      if (cErr) {
        console.error("[admin/users/patch] count admins", cErr);
        return failJson(500, "Could not verify admins.");
      }

      if ((count ?? 0) <= 1) {
        return failJson(400, "You must keep at least one admin.");
      }
    }

    const { error } = await svc.from("profiles").update({ role: newRole }).eq("id", targetId);

    if (error) {
      console.error("[admin/users/patch]", error);
      return failJson(500, "Could not update role.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("admin/users PATCH", e);
  }
}
