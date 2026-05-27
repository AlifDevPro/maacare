import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { saveSectionVersion, getDocsAdminClient } from "@/lib/docs-admin/repository";
import { revalidateDocsRuntimeCaches } from "@/lib/docs-runtime/snapshot";
import { docsSectionTypeSchema } from "@/lib/docs-runtime/types";

const createSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  sectionType: docsSectionTypeSchema,
  bodyMd: z.string().default(""),
  bodyHtml: z.string().default(""),
  summary: z.string().default(""),
  sortOrder: z.number().int().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  isVisible: z.boolean().default(true),
  metadata: z.record(z.any()).default({}),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  sectionType: docsSectionTypeSchema.optional(),
  bodyMd: z.string().optional(),
  bodyHtml: z.string().optional(),
  summary: z.string().optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["draft", "published"]).optional(),
  isVisible: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
  snapshotKind: z.enum(["save", "publish"]).default("save"),
});

export async function GET() {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;
    const svc = getDocsAdminClient();
    const { data, error } = await svc.from("docs_sections").select("*").order("sort_order", { ascending: true });
    if (error) return failJson(500, error.message || "Could not load docs sections.");
    return Response.json({ sections: data ?? [] });
  } catch (e) {
    return serverErrorJson("admin/docs/sections GET", e);
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
      .from("docs_sections")
      .insert({
        slug: payload.slug,
        title: payload.title,
        section_type: payload.sectionType,
        body_md: payload.bodyMd,
        body_html: payload.bodyHtml,
        summary: payload.summary,
        sort_order: payload.sortOrder ?? 100,
        status: payload.status,
        is_visible: payload.isVisible,
        metadata: payload.metadata,
        updated_by: gate.userId,
      })
      .select("*")
      .single();
    if (error || !data) return failJson(500, error?.message || "Could not create docs section.");

    await saveSectionVersion({
      sectionId: data.id,
      title: data.title,
      bodyMd: data.body_md,
      bodyHtml: data.body_html,
      summary: data.summary,
      status: data.status,
      sectionType: data.section_type,
      metadata: data.metadata ?? {},
      userId: gate.userId,
      snapshotKind: "save",
    });
    revalidateDocsRuntimeCaches();
    return Response.json({ ok: true, section: data });
  } catch (e) {
    return serverErrorJson("admin/docs/sections POST", e);
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
    if (payload.slug !== undefined) updates.slug = payload.slug;
    if (payload.title !== undefined) updates.title = payload.title;
    if (payload.sectionType !== undefined) updates.section_type = payload.sectionType;
    if (payload.bodyMd !== undefined) updates.body_md = payload.bodyMd;
    if (payload.bodyHtml !== undefined) updates.body_html = payload.bodyHtml;
    if (payload.summary !== undefined) updates.summary = payload.summary;
    if (payload.sortOrder !== undefined) updates.sort_order = payload.sortOrder;
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.isVisible !== undefined) updates.is_visible = payload.isVisible;
    if (payload.metadata !== undefined) updates.metadata = payload.metadata;

    const { data, error } = await svc
      .from("docs_sections")
      .update(updates)
      .eq("id", payload.id)
      .select("*")
      .single();
    if (error || !data) return failJson(500, error?.message || "Could not update docs section.");

    await saveSectionVersion({
      sectionId: data.id,
      title: data.title,
      bodyMd: data.body_md,
      bodyHtml: data.body_html,
      summary: data.summary,
      status: data.status,
      sectionType: data.section_type,
      metadata: data.metadata ?? {},
      userId: gate.userId,
      snapshotKind: payload.snapshotKind,
    });

    revalidateDocsRuntimeCaches();
    return Response.json({ ok: true, section: data });
  } catch (e) {
    return serverErrorJson("admin/docs/sections PATCH", e);
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
    const { error } = await svc.from("docs_sections").delete().eq("id", id);
    if (error) return failJson(500, error.message || "Could not delete docs section.");
    revalidateDocsRuntimeCaches();
    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("admin/docs/sections DELETE", e);
  }
}

