import { NextRequest } from "next/server";
import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";

const uuid = z.string().uuid();

const patchSchema = z.object({
  moderationStatus: z.enum(["visible", "hidden", "pending"]),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const parsedId = uuid.safeParse((await context.params).postId);
    if (!parsedId.success) return failJson(400, "Invalid post.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const { error } = await gate.supabase
      .from("community_posts")
      .update({ moderation_status: parsed.data.moderationStatus })
      .eq("id", parsedId.data);

    if (error) {
      console.error("[admin/community/post PATCH]", error);
      return failJson(500, "Could not update post.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("admin/community/posts PATCH", e);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const parsedId = uuid.safeParse((await context.params).postId);
    if (!parsedId.success) return failJson(400, "Invalid post.");

    const { error } = await gate.supabase.from("community_posts").delete().eq("id", parsedId.data);

    if (error) {
      console.error("[admin/community/post DELETE]", error);
      return failJson(500, "Could not delete post.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("admin/community/posts DELETE", e);
  }
}
