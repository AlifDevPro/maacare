import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

export function getDocsAdminClient() {
  const service = tryCreateSupabaseServiceClient();
  if (!service) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for docs admin operations.");
  return service;
}

async function nextVersionNo(sectionId: string) {
  const svc = getDocsAdminClient();
  const { data, error } = await svc
    .from("docs_section_versions")
    .select("version_no")
    .eq("section_id", sectionId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message || "Could not load section versions.");
  return (data?.version_no ?? 0) + 1;
}

export async function saveSectionVersion(input: {
  sectionId: string;
  title: string;
  bodyMd: string;
  bodyHtml: string;
  summary: string;
  status: "draft" | "published";
  sectionType: string;
  metadata: Record<string, unknown>;
  userId: string;
  snapshotKind: "save" | "publish" | "restore";
}) {
  const svc = getDocsAdminClient();
  const versionNo = await nextVersionNo(input.sectionId);
  const { error } = await svc.from("docs_section_versions").insert({
    section_id: input.sectionId,
    version_no: versionNo,
    title: input.title,
    body_md: input.bodyMd,
    body_html: input.bodyHtml,
    summary: input.summary,
    status: input.status,
    section_type: input.sectionType,
    metadata: input.metadata,
    snapshot_kind: input.snapshotKind,
    created_by: input.userId,
  });
  if (error) throw new Error(error.message || "Could not write section version.");
  return { versionNo };
}

export async function recordPublishSnapshot(userId: string) {
  const svc = getDocsAdminClient();
  const snapshotId = crypto.randomUUID();
  const { error: upError } = await svc
    .from("docs_publication_settings")
    .upsert(
      {
        key: "primary",
        published_snapshot_id: snapshotId,
        updated_by: userId,
      },
      { onConflict: "key" },
    );
  if (upError) throw new Error(upError.message || "Could not update publication snapshot.");
  return snapshotId;
}

