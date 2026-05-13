import { loadProfileBundle } from "@/lib/app/profile-bundle-data";
import { loadVitalsList } from "@/lib/app/user-lists-data";
import {
  buildProfileExportMarkdown,
  type HealthDocumentExportRow,
  type SymptomExportRow,
} from "@/lib/profile/export-summary-markdown";
import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const supabase = await createSupabaseServerClient();
    const nowIso = new Date().toISOString();
    const day = nowIso.slice(0, 10);

    const [bundle, vitals, symptomsRes, documentsRes] = await Promise.all([
      loadProfileBundle(supabase, session.id),
      loadVitalsList(supabase, session.id, 20),
      supabase
        .from("symptom_logs")
        .select("logged_at, title, description, severity, symptom_codes")
        .eq("user_id", session.id)
        .order("logged_at", { ascending: false })
        .limit(15),
      supabase
        .from("health_documents")
        .select("title, uploaded_at, notes, mime_type, file_size_bytes")
        .eq("user_id", session.id)
        .order("uploaded_at", { ascending: false })
        .limit(30),
    ]);

    if (symptomsRes.error) {
      console.error("[export-summary] symptoms:", symptomsRes.error);
      return failJson(500, "Could not load symptom history for export.");
    }
    if (documentsRes.error) {
      console.error("[export-summary] documents:", documentsRes.error);
      return failJson(500, "Could not load document list for export.");
    }

    const symptoms: SymptomExportRow[] = (symptomsRes.data ?? []).map((r) => ({
      loggedAt: r.logged_at as string,
      title: (r.title as string | null) ?? null,
      description: (r.description as string | null) ?? null,
      severity: (r.severity as number | null) ?? null,
      symptomCodes: ((r.symptom_codes as string[] | null) ?? []).filter(Boolean),
    }));

    const documents: HealthDocumentExportRow[] = (documentsRes.data ?? []).map((r) => ({
      title: r.title as string,
      uploadedAt: r.uploaded_at as string,
      notes: (r.notes as string | null) ?? null,
      mimeType: (r.mime_type as string | null) ?? null,
      fileSizeBytes: (r.file_size_bytes as number | null) ?? null,
    }));

    const md = buildProfileExportMarkdown({
      bundle,
      vitals,
      symptoms,
      documents,
      generatedAtIso: nowIso,
    });

    const filename = `maacare-health-summary-${day}.md`;
    return new Response(md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return serverErrorJson("profile export-summary GET", e);
  }
}
