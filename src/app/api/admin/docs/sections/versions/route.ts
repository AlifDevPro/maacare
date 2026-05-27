import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { getDocsAdminClient } from "@/lib/docs-admin/repository";

export async function GET(req: Request) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;
    const url = new URL(req.url);
    const sectionId = url.searchParams.get("sectionId");
    if (!sectionId) return failJson(400, "Missing sectionId.");

    const svc = getDocsAdminClient();
    const { data, error } = await svc
      .from("docs_section_versions")
      .select("*")
      .eq("section_id", sectionId)
      .order("version_no", { ascending: false });
    if (error) return failJson(500, error.message || "Could not load section versions.");
    return Response.json({ versions: data ?? [] });
  } catch (e) {
    return serverErrorJson("admin/docs/sections/versions GET", e);
  }
}

