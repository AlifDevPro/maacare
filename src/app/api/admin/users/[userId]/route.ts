import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

const uuid = z.string().uuid();

const patchSchema = z.object({
  role: z.enum(["user", "moderator", "admin"]).optional(),
  displayName: z.string().min(1).max(200).optional(),
  language: z.enum(["en", "bn"]).optional(),
  profession: z.string().max(64).nullable().optional(),
  verifiedProfessional: z.boolean().optional(),
  communityShowExtendedProfile: z.boolean().optional(),
  adminNote: z.string().max(2000).nullable().optional(),
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

    const targetId = parsedId.data;

    const { data: authData, error: authErr } = await svc.auth.admin.getUserById(targetId);
    if (authErr || !authData?.user) {
      return failJson(404, "Auth user not found.");
    }
    const au = authData.user;

    const { data: profile, error: pErr } = await svc
      .from("profiles")
      .select(
        "id, email, display_name, role, language, created_at, profession, verified_professional, community_show_extended_profile, admin_note, ban_reason, phone, avatar_url",
      )
      .eq("id", targetId)
      .maybeSingle();

    if (pErr) {
      console.error("[admin/users GET] profile", pErr);
      return failJson(500, "Could not load profile.");
    }

    const [{ data: recentPosts }, { data: recentComments }] = await Promise.all([
      svc
        .from("community_posts")
        .select("id, title, body, created_at, moderation_status")
        .eq("author_id", targetId)
        .order("created_at", { ascending: false })
        .limit(12),
      svc
        .from("community_comments")
        .select("id, body, created_at, post_id, moderation_status")
        .eq("author_id", targetId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    return Response.json({
      auth: {
        id: au.id,
        email: au.email ?? null,
        emailConfirmedAt: au.email_confirmed_at ?? null,
        lastSignInAt: au.last_sign_in_at ?? null,
        bannedUntil: au.banned_until ?? null,
        createdAt: au.created_at ?? null,
      },
      profile: profile ?? null,
      recentPosts: recentPosts ?? [],
      recentComments: recentComments ?? [],
    });
  } catch (e) {
    return serverErrorJson("admin/users GET", e);
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

    const targetId = parsedId.data;
    const body = parsed.data;
    if (Object.keys(body).length === 0) {
      return failJson(400, "Nothing to update.");
    }

    const svc = tryCreateSupabaseServiceClient();
    if (!svc) {
      return failJson(503, "Server missing SUPABASE_SERVICE_ROLE_KEY.");
    }

    if (body.role !== undefined) {
      const { data: target, error: loadErr } = await svc
        .from("profiles")
        .select("role")
        .eq("id", targetId)
        .maybeSingle();

      if (loadErr || !target) {
        return failJson(404, "User not found.");
      }

      if (target.role === "admin" && body.role !== "admin") {
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

      const { error } = await svc.from("profiles").update({ role: body.role }).eq("id", targetId);
      if (error) {
        console.error("[admin/users/patch] role", error);
        return failJson(500, "Could not update role.");
      }
    }

    const profileUpdates: Record<string, unknown> = {};
    if (body.displayName !== undefined) profileUpdates.display_name = body.displayName.trim();
    if (body.language !== undefined) profileUpdates.language = body.language;
    if (body.profession !== undefined) profileUpdates.profession = body.profession?.trim() || null;
    if (body.verifiedProfessional !== undefined) {
      profileUpdates.verified_professional = body.verifiedProfessional;
    }
    if (body.communityShowExtendedProfile !== undefined) {
      profileUpdates.community_show_extended_profile = body.communityShowExtendedProfile;
    }
    if (body.adminNote !== undefined) profileUpdates.admin_note = body.adminNote?.trim() || null;

    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await svc.from("profiles").update(profileUpdates).eq("id", targetId);
      if (error) {
        console.error("[admin/users/patch] profile", error);
        return failJson(500, "Could not update profile fields.");
      }
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("admin/users PATCH", e);
  }
}
