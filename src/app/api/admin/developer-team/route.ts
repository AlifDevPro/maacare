import { NextResponse } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { escapeIlike } from "@/lib/community/aggregate-counts";
import { revalidateLandingTeamCache } from "@/lib/team/landing-team-members";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

const postSchema = z
  .object({
    userId: z.string().uuid().optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => Boolean(d.userId?.trim()) || Boolean(d.email?.trim()), {
    message: "Provide userId or email.",
  });

export async function GET() {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const svc = tryCreateSupabaseServiceClient();
    if (!svc) return failJson(503, "Server missing SUPABASE_SERVICE_ROLE_KEY.");

    const { data, error } = await svc
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
        created_at,
        profiles ( display_name, email, avatar_url )
      `,
      )
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[admin/developer-team GET]", error);
      return failJson(500, "Could not load team directory.");
    }

    type P = { display_name: string; email: string | null; avatar_url: string | null };
    type Row = {
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
      created_at: string;
      profiles: P | P[] | null;
    };

    const members = (data ?? []).map((raw) => {
      const r = raw as Row;
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        userId: r.user_id,
        cardDisplayName: r.card_display_name,
        jobTitle: r.job_title,
        bio: r.bio,
        photoUrl: r.photo_url,
        socialGithub: r.social_github,
        socialTwitter: r.social_twitter,
        socialLinkedin: r.social_linkedin,
        socialWebsite: r.social_website,
        sortOrder: r.sort_order,
        published: r.published,
        showOnTeamSection: r.show_on_team_section,
        createdAt: r.created_at,
        profileDisplayName: p?.display_name ?? null,
        profileEmail: p?.email ?? null,
        profileAvatarUrl: p?.avatar_url ?? null,
      };
    });

    return NextResponse.json({ members });
  } catch (e) {
    return serverErrorJson("admin_developer_team GET", e);
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }
    const parsed = postSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const svc = tryCreateSupabaseServiceClient();
    if (!svc) return failJson(503, "Server missing SUPABASE_SERVICE_ROLE_KEY.");

    let targetId: string | null = parsed.data.userId?.trim() ?? null;
    const emailRaw = parsed.data.email?.trim().toLowerCase();

    if (!targetId && emailRaw) {
      const esc = escapeIlike(emailRaw);
      const { data: rows, error: lookErr } = await svc.from("profiles").select("id, email").ilike("email", esc);

      if (lookErr) {
        console.error("[admin/developer-team POST] email lookup", lookErr);
        return failJson(500, "Could not look up user by email.");
      }
      const exact = (rows ?? []).filter((r) => (r.email as string | null)?.toLowerCase() === emailRaw);
      if (exact.length === 0) {
        return failJson(404, "No profile found with that email.");
      }
      if (exact.length > 1) {
        return failJson(409, "Multiple profiles match that email. Use userId instead.");
      }
      targetId = exact[0]!.id as string;
    }

    if (!targetId) {
      return failJson(400, "Could not resolve user.");
    }

    const { data: prof, error: pErr } = await svc
      .from("profiles")
      .select("id")
      .eq("id", targetId)
      .maybeSingle();
    if (pErr || !prof) {
      return failJson(404, "Profile not found for that user id.");
    }

    const { error: insErr } = await svc.from("developer_team_profiles").insert({
      user_id: targetId,
      job_title: "",
      bio: "",
      sort_order: 100,
      published: false,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        return failJson(409, "That user is already in the team directory.");
      }
      console.error("[admin/developer-team POST]", insErr);
      return failJson(500, "Could not add team member.");
    }

    revalidateLandingTeamCache();
    return NextResponse.json({ ok: true, userId: targetId });
  } catch (e) {
    return serverErrorJson("admin_developer_team POST", e);
  }
}
