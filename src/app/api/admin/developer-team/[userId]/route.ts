import { NextResponse } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

const uuid = z.string().uuid();

const optionalUrl = z
  .union([z.literal(""), z.string().url()])
  .optional()
  .transform((v) => (v === "" ? null : v));

const patchSchema = z.object({
  sortOrder: z.number().int().min(0).max(1_000_000).optional(),
  published: z.boolean().optional(),
  cardDisplayName: z.string().max(200).nullable().optional(),
  jobTitle: z.string().max(200).optional(),
  bio: z.string().max(4000).optional(),
  photoUrl: optionalUrl,
  socialGithub: optionalUrl,
  socialTwitter: optionalUrl,
  socialLinkedin: optionalUrl,
  socialWebsite: optionalUrl,
});

export async function PATCH(req: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const parsedId = uuid.safeParse((await context.params).userId);
    if (!parsedId.success) return failJson(400, "Invalid user id.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const svc = tryCreateSupabaseServiceClient();
    if (!svc) return failJson(503, "Server missing SUPABASE_SERVICE_ROLE_KEY.");

    const u = parsed.data;
    const patch: Record<string, unknown> = {};
    if (u.sortOrder !== undefined) patch.sort_order = u.sortOrder;
    if (u.published !== undefined) patch.published = u.published;
    if (u.cardDisplayName !== undefined) patch.card_display_name = u.cardDisplayName?.trim() || null;
    if (u.jobTitle !== undefined) patch.job_title = u.jobTitle.trim();
    if (u.bio !== undefined) patch.bio = u.bio.trim();
    if (u.photoUrl !== undefined) patch.photo_url = u.photoUrl;
    if (u.socialGithub !== undefined) patch.social_github = u.socialGithub;
    if (u.socialTwitter !== undefined) patch.social_twitter = u.socialTwitter;
    if (u.socialLinkedin !== undefined) patch.social_linkedin = u.socialLinkedin;
    if (u.socialWebsite !== undefined) patch.social_website = u.socialWebsite;

    if (Object.keys(patch).length === 0) {
      return failJson(400, "No fields to update.");
    }

    const { error } = await svc.from("developer_team_profiles").update(patch).eq("user_id", parsedId.data);

    if (error) {
      console.error("[admin/developer-team PATCH]", error);
      return failJson(500, "Could not update team member.");
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverErrorJson("admin_developer_team PATCH", e);
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const parsedId = uuid.safeParse((await context.params).userId);
    if (!parsedId.success) return failJson(400, "Invalid user id.");

    const svc = tryCreateSupabaseServiceClient();
    if (!svc) return failJson(503, "Server missing SUPABASE_SERVICE_ROLE_KEY.");

    const { error } = await svc.from("developer_team_profiles").delete().eq("user_id", parsedId.data);

    if (error) {
      console.error("[admin/developer-team DELETE]", error);
      return failJson(500, "Could not remove team member.");
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverErrorJson("admin_developer_team DELETE", e);
  }
}
