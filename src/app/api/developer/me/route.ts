import { NextResponse } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const optionalUrl = z
  .union([z.literal(""), z.string().url(), z.null()])
  .optional()
  .transform((v) => (v === "" ? null : v === undefined ? undefined : v));

const patchSchema = z.object({
  cardDisplayName: z.string().max(200).nullable().optional(),
  jobTitle: z.string().max(200).optional(),
  bio: z.string().max(4000).optional(),
  photoUrl: optionalUrl,
  socialGithub: optionalUrl,
  socialTwitter: optionalUrl,
  socialLinkedin: optionalUrl,
  socialWebsite: optionalUrl,
  showOnTeamSection: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("developer_team_profiles")
      .select(
        `
        user_id,
        card_display_name,
        job_title,
        bio,
        photo_url,
        social_github,
        social_twitter,
        social_linkedin,
        social_website,
        sort_order,
        published,
        show_on_team_section,
        profiles ( display_name, avatar_url, email )
      `,
      )
      .eq("user_id", session.id)
      .maybeSingle();

    if (error) {
      console.error("[developer/me GET]", error);
      return failJson(500, "Could not load developer profile.");
    }
    if (!data) return failJson(404, "No developer team profile for this account.");

    type P = { display_name: string; avatar_url: string | null; email: string | null };
    const row = data as {
      user_id: string;
      card_display_name: string | null;
      job_title: string;
      bio: string;
      photo_url: string | null;
      social_github: string | null;
      social_twitter: string | null;
      social_linkedin: string | null;
      social_website: string | null;
      sort_order: number;
      published: boolean;
      show_on_team_section: boolean;
      profiles: P | P[] | null;
    };
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

    return NextResponse.json({
      profile: {
        userId: row.user_id,
        cardDisplayName: row.card_display_name,
        jobTitle: row.job_title,
        bio: row.bio,
        photoUrl: row.photo_url,
        socialGithub: row.social_github,
        socialTwitter: row.social_twitter,
        socialLinkedin: row.social_linkedin,
        socialWebsite: row.social_website,
        sortOrder: row.sort_order,
        published: row.published,
        showOnTeamSection: row.show_on_team_section,
        profileDisplayName: p?.display_name ?? session.name,
        profileAvatarUrl: p?.avatar_url ?? session.avatarUrl ?? null,
        profileEmail: p?.email ?? session.email,
      },
    });
  } catch (e) {
    return serverErrorJson("developer_me GET", e);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const svc = tryCreateSupabaseServiceClient();
    if (!svc) {
      return failJson(503, "Server is missing service configuration.");
    }

    const { data: exists, error: exErr } = await svc
      .from("developer_team_profiles")
      .select("user_id")
      .eq("user_id", session.id)
      .maybeSingle();
    if (exErr || !exists) {
      return failJson(404, "No developer team profile for this account.");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const u = parsed.data;
    const patch: Record<string, unknown> = {};
    if (u.cardDisplayName !== undefined) patch.card_display_name = u.cardDisplayName?.trim() || null;
    if (u.jobTitle !== undefined) patch.job_title = u.jobTitle.trim();
    if (u.bio !== undefined) patch.bio = u.bio.trim();
    if (u.photoUrl !== undefined) patch.photo_url = u.photoUrl;
    if (u.socialGithub !== undefined) patch.social_github = u.socialGithub;
    if (u.socialTwitter !== undefined) patch.social_twitter = u.socialTwitter;
    if (u.socialLinkedin !== undefined) patch.social_linkedin = u.socialLinkedin;
    if (u.socialWebsite !== undefined) patch.social_website = u.socialWebsite;
    if (u.showOnTeamSection !== undefined) patch.show_on_team_section = u.showOnTeamSection;

    if (Object.keys(patch).length === 0) {
      return failJson(400, "No fields to update.");
    }

    const { error } = await svc.from("developer_team_profiles").update(patch).eq("user_id", session.id);

    if (error) {
      console.error("[developer/me PATCH]", error);
      return failJson(500, "Could not update developer profile.");
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverErrorJson("developer_me PATCH", e);
  }
}
