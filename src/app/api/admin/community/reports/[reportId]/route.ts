import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";

const patchSchema = z.object({
  status: z.enum(["resolved", "rejected"]),
  adminNote: z.string().max(1000).optional(),
  hidePost: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const reportId = z.string().uuid().safeParse((await context.params).reportId);
    if (!reportId.success) return failJson(400, "Invalid report.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const { data: reportRow, error: reportErr } = await gate.supabase
      .from("community_post_reports")
      .select("id, post_id")
      .eq("id", reportId.data)
      .maybeSingle();
    if (reportErr || !reportRow) return failJson(404, "Report not found.");

    const { error } = await gate.supabase
      .from("community_post_reports")
      .update({
        status: parsed.data.status,
        admin_note: parsed.data.adminNote?.trim() || null,
        reviewed_by: gate.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reportId.data);
    if (error) {
      console.error("[admin/community/report PATCH]", error);
      return failJson(500, "Could not update report.");
    }

    if (parsed.data.hidePost) {
      const { error: hideErr } = await gate.supabase
        .from("community_posts")
        .update({ moderation_status: "hidden" })
        .eq("id", reportRow.post_id);
      if (hideErr) {
        console.error("[admin/community/report hide-post]", hideErr);
        return failJson(500, "Report updated but could not hide post.");
      }
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("admin/community/report PATCH", e);
  }
}

