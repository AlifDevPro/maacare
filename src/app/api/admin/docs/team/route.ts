import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { getDocsAdminClient } from "@/lib/docs-admin/repository";
import { revalidateDocsRuntimeCaches } from "@/lib/docs-runtime/snapshot";

const createSchema = z.object({
  fullName: z.string().min(1),
  role: z.string().min(1),
  email: z.string().email(),
  avatarUrl: z.string().url().nullable().optional(),
  avatarWidth: z.number().int().positive().nullable().optional(),
  avatarHeight: z.number().int().positive().nullable().optional(),
  bio: z.string().default(""),
  displayOrder: z.number().int().optional(),
  active: z.boolean().default(true),
  metadata: z.record(z.any()).default({}),
});

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
  fullName: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  email: z.string().email().optional(),
  bio: z.string().optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function GET() {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;
    const svc = getDocsAdminClient();
    const { data, error } = await svc
      .from("docs_team_members")
      .select("*")
      .order("display_order", { ascending: true });
    if (error) return failJson(500, error.message || "Could not load team members.");
    return Response.json({ team: data ?? [] });
  } catch (e) {
    return serverErrorJson("admin/docs/team GET", e);
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
      return failJson(400, "Invalid JSON body.");
    }
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);
    const payload = parsed.data;
    const svc = getDocsAdminClient();
    const { data, error } = await svc
      .from("docs_team_members")
      .insert({
        full_name: payload.fullName,
        role: payload.role,
        email: payload.email,
        avatar_url: payload.avatarUrl ?? null,
        avatar_width: payload.avatarWidth ?? null,
        avatar_height: payload.avatarHeight ?? null,
        bio: payload.bio,
        display_order: payload.displayOrder ?? 100,
        active: payload.active,
        metadata: payload.metadata,
        updated_by: gate.userId,
      })
      .select("*")
      .single();
    if (error || !data) return failJson(500, error?.message || "Could not create team member.");
    revalidateDocsRuntimeCaches();
    return Response.json({ ok: true, member: data });
  } catch (e) {
    return serverErrorJson("admin/docs/team POST", e);
  }
}

export async function PATCH(req: Request) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON body.");
    }
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);
    const payload = parsed.data;
    const svc = getDocsAdminClient();
    const updates: Record<string, unknown> = { updated_by: gate.userId };
    if (payload.fullName !== undefined) updates.full_name = payload.fullName;
    if (payload.role !== undefined) updates.role = payload.role;
    if (payload.email !== undefined) updates.email = payload.email;
    if (payload.avatarUrl !== undefined) updates.avatar_url = payload.avatarUrl;
    if (payload.avatarWidth !== undefined) updates.avatar_width = payload.avatarWidth;
    if (payload.avatarHeight !== undefined) updates.avatar_height = payload.avatarHeight;
    if (payload.bio !== undefined) updates.bio = payload.bio;
    if (payload.displayOrder !== undefined) updates.display_order = payload.displayOrder;
    if (payload.active !== undefined) updates.active = payload.active;
    if (payload.metadata !== undefined) updates.metadata = payload.metadata;
    const { data, error } = await svc
      .from("docs_team_members")
      .update(updates)
      .eq("id", payload.id)
      .select("*")
      .single();
    if (error || !data) return failJson(500, error?.message || "Could not update team member.");
    revalidateDocsRuntimeCaches();
    return Response.json({ ok: true, member: data });
  } catch (e) {
    return serverErrorJson("admin/docs/team PATCH", e);
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return failJson(400, "Missing id.");
    const svc = getDocsAdminClient();
    const { error } = await svc.from("docs_team_members").delete().eq("id", id);
    if (error) return failJson(500, error.message || "Could not delete team member.");
    revalidateDocsRuntimeCaches();
    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("admin/docs/team DELETE", e);
  }
}

