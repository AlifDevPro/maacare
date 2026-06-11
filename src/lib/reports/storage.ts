import { isReportImageFile } from "@/lib/reports/file-utils";

export const REPORT_DOCUMENT_BUCKET = "health-documents";

const SIGNED_URL_TTL_SECONDS = 3600;

export function sanitizeReportFileName(fileName: string): string {
  const base = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "") || "report.jpg";
  return base.slice(0, 120);
}

export function buildReportStoragePath(userId: string, reportId: string, fileName: string): string {
  return `${userId}/reports/${reportId}/${sanitizeReportFileName(fileName)}`;
}

export async function uploadReportImage(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  userId: string,
  reportId: string,
  file: File,
): Promise<{ bucket: string; path: string }> {
  if (!isReportImageFile(file)) {
    throw new Error("Only image uploads can be stored.");
  }

  const bucket = REPORT_DOCUMENT_BUCKET;
  const path = buildReportStoragePath(userId, reportId, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });

  if (error) throw new Error(error.message);
  return { bucket, path };
}

export async function getReportImageSignedUrl(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  bucket: string | null | undefined,
  path: string | null | undefined,
): Promise<string | null> {
  if (!bucket || !path) return null;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function deleteReportImage(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  bucket: string | null | undefined,
  path: string | null | undefined,
): Promise<void> {
  if (!bucket || !path) return;

  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(error.message);
}
