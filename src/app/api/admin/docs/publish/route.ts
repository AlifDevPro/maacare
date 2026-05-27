import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { getDocsAdminClient, recordPublishSnapshot, saveSectionVersion } from "@/lib/docs-admin/repository";
import { revalidateDocsRuntimeCaches } from "@/lib/docs-runtime/snapshot";

const schema = z.object({
  sectionIds: z.array(z.string().uuid()).optional(),
});

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
    const parsed = schema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const svc = getDocsAdminClient();
    let query = svc.from("docs_sections").select("*");
    if (parsed.data.sectionIds?.length) query = query.in("id", parsed.data.sectionIds);
    const { data: sections, error: loadError } = await query;
    if (loadError) return failJson(500, loadError.message || "Could not load sections for publish.");

    for (const section of sections ?? []) {
      const { data: updated, error } = await svc
        .from("docs_sections")
        .update({ status: "published", updated_by: gate.userId })
        .eq("id", section.id)
        .select("*")
        .single();
      if (error || !updated) return failJson(500, error?.message || "Could not publish section.");
      await saveSectionVersion({
        sectionId: updated.id,
        title: updated.title,
        bodyMd: updated.body_md,
        bodyHtml: updated.body_html,
        summary: updated.summary,
        status: updated.status,
        sectionType: updated.section_type,
        metadata: updated.metadata ?? {},
        userId: gate.userId,
        snapshotKind: "publish",
      });
    }

    const snapshotId = await recordPublishSnapshot(gate.userId);
    revalidateDocsRuntimeCaches();
    return Response.json({ ok: true, snapshotId, publishedCount: (sections ?? []).length });
  } catch (e) {
    return serverErrorJson("admin/docs/publish POST", e);
  }
}

