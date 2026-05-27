import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { getDocsAdminClient, saveSectionVersion } from "@/lib/docs-admin/repository";
import { revalidateDocsRuntimeCaches } from "@/lib/docs-runtime/snapshot";

const schema = z.object({
  sectionId: z.string().uuid(),
  versionId: z.string().uuid(),
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
    const { data: version, error: versionError } = await svc
      .from("docs_section_versions")
      .select("*")
      .eq("id", parsed.data.versionId)
      .eq("section_id", parsed.data.sectionId)
      .maybeSingle();
    if (versionError || !version) return failJson(404, "Requested version not found.");

    const { data: section, error: updateError } = await svc
      .from("docs_sections")
      .update({
        title: version.title,
        body_md: version.body_md,
        body_html: version.body_html,
        summary: version.summary,
        section_type: version.section_type,
        status: version.status,
        metadata: version.metadata ?? {},
        updated_by: gate.userId,
      })
      .eq("id", parsed.data.sectionId)
      .select("*")
      .single();
    if (updateError || !section) return failJson(500, updateError?.message || "Could not restore section.");

    await saveSectionVersion({
      sectionId: section.id,
      title: section.title,
      bodyMd: section.body_md,
      bodyHtml: section.body_html,
      summary: section.summary,
      status: section.status,
      sectionType: section.section_type,
      metadata: section.metadata ?? {},
      userId: gate.userId,
      snapshotKind: "restore",
    });

    revalidateDocsRuntimeCaches();
    return Response.json({ ok: true, section });
  } catch (e) {
    return serverErrorJson("admin/docs/sections/restore POST", e);
  }
}

