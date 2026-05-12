import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";

const uuid = z.string().uuid();

const patchSchema = z.object({
  status: z.enum(["new", "triaged", "resolved"]).optional(),
  adminNotes: z.string().max(5000).nullable().optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const parsedId = uuid.safeParse((await context.params).id);
    if (!parsedId.success) return failJson(400, "Invalid id.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    if (Object.keys(parsed.data).length === 0) {
      return failJson(400, "Nothing to update.");
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.adminNotes !== undefined) updates.admin_notes = parsed.data.adminNotes;

    const { error } = await gate.supabase.from("app_feedback").update(updates).eq("id", parsedId.data);

    if (error) {
      console.error("[admin/feedback PATCH]", error);
      return failJson(500, "Could not update feedback.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("admin/feedback PATCH", e);
  }
}
