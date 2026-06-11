import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { deleteUserMedicalReport, getUserMedicalReport } from "@/lib/reports/repository";
import { deleteReportImage, getReportImageSignedUrl } from "@/lib/reports/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ reportId: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Please sign in and try again.");

    const { reportId } = await params;
    const supabase = await createSupabaseServerClient();
    const report = await getUserMedicalReport(supabase, session.id, reportId);
    if (!report) return failJson(404, "Report not found.");

    const imageUrl = await getReportImageSignedUrl(supabase, report.storage_bucket, report.storage_path);

    return Response.json({ report, imageUrl });
  } catch (e) {
    return serverErrorJson("reports/[reportId] GET", e);
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Please sign in and try again.");

    const { reportId } = await params;
    const supabase = await createSupabaseServerClient();
    const report = await getUserMedicalReport(supabase, session.id, reportId);
    if (!report) return failJson(404, "Report not found.");

    await deleteReportImage(supabase, report.storage_bucket, report.storage_path);

    const deleted = await deleteUserMedicalReport(supabase, session.id, reportId);
    if (!deleted) return failJson(404, "Report not found.");

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("reports/[reportId] DELETE", e);
  }
}
