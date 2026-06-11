import type { ReportAnalysis } from "@/lib/reports/parse-analysis";
import type { ExtractionMode } from "@/lib/reports/extraction";
import { getReportImageSignedUrl } from "@/lib/reports/storage";

export type UserMedicalReportRow = {
  id: string;
  user_id: string;
  title: string;
  input_mode: "file" | "text";
  file_name: string | null;
  file_mime: string | null;
  file_size_bytes: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  extracted_text: string | null;
  analysis: ReportAnalysis;
  is_medical_report: boolean;
  risk_level: string | null;
  provider: string | null;
  extraction_mode: string | null;
  embedding_status: "pending" | "ready" | "failed" | "skipped";
  created_at: string;
  updated_at: string;
};

export type UserMedicalReportListItem = {
  id: string;
  title: string;
  input_mode: "file" | "text";
  file_name: string | null;
  is_medical_report: boolean;
  risk_level: string | null;
  summary: string;
  document_type: ReportAnalysis["documentType"];
  findings_count: number;
  recommendations_count: number;
  has_file: boolean;
  thumbnail_url?: string | null;
  embedding_status: string;
  created_at: string;
  updated_at: string;
};

function rowToListItem(row: UserMedicalReportRow): UserMedicalReportListItem {
  const analysis = row.analysis as ReportAnalysis;
  return {
    id: row.id,
    title: row.title,
    input_mode: row.input_mode,
    file_name: row.file_name,
    is_medical_report: row.is_medical_report,
    risk_level: row.risk_level,
    summary: analysis?.summary ?? "",
    document_type: analysis?.documentType ?? "other",
    findings_count: analysis?.findings?.length ?? 0,
    recommendations_count: analysis?.recommendations?.length ?? 0,
    has_file: Boolean(row.storage_bucket && row.storage_path),
    embedding_status: row.embedding_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listUserMedicalReports(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  userId: string,
  options?: { search?: string; limit?: number; offset?: number },
): Promise<{ items: UserMedicalReportListItem[]; total: number }> {
  const limit = Math.min(50, Math.max(1, options?.limit ?? 20));
  const offset = Math.max(0, options?.offset ?? 0);
  const search = (options?.search ?? "").trim();

  let query = supabase
    .from("user_medical_reports")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`title.ilike.%${search}%,extracted_text.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as UserMedicalReportRow[];
  const items = await Promise.all(
    rows.map(async (row) => {
      const item = rowToListItem(row);
      if (!item.has_file) return item;
      const thumbnail_url = await getReportImageSignedUrl(supabase, row.storage_bucket, row.storage_path);
      return { ...item, thumbnail_url };
    }),
  );

  return {
    items,
    total: count ?? rows.length,
  };
}

export async function getUserMedicalReport(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  userId: string,
  reportId: string,
): Promise<UserMedicalReportRow | null> {
  const { data, error } = await supabase
    .from("user_medical_reports")
    .select("*")
    .eq("user_id", userId)
    .eq("id", reportId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as UserMedicalReportRow;
}

export async function deleteUserMedicalReport(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  userId: string,
  reportId: string,
): Promise<boolean> {
  const { error, count } = await supabase
    .from("user_medical_reports")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("id", reportId);

  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export type PersistReportInput = {
  userId: string;
  title: string;
  inputMode: "file" | "text";
  fileName?: string | null;
  fileMime?: string | null;
  fileSizeBytes?: number | null;
  extractedText?: string | null;
  analysis: ReportAnalysis;
  provider: string;
  extractionMode: ExtractionMode;
};

export async function insertUserMedicalReport(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  input: PersistReportInput,
): Promise<UserMedicalReportRow> {
  const isMedical = input.analysis.isMedicalReport !== false;
  const { data, error } = await supabase
    .from("user_medical_reports")
    .insert({
      user_id: input.userId,
      title: input.title || "Medical report",
      input_mode: input.inputMode,
      file_name: input.fileName ?? null,
      file_mime: input.fileMime ?? null,
      file_size_bytes: input.fileSizeBytes ?? null,
      extracted_text: input.extractedText ?? null,
      analysis: input.analysis,
      is_medical_report: isMedical,
      risk_level: input.analysis.riskLevel,
      provider: input.provider,
      extraction_mode: input.extractionMode,
      embedding_status: isMedical ? "pending" : "skipped",
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save report");
  return data as UserMedicalReportRow;
}

export async function updateReportEmbeddingStatus(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  reportId: string,
  userId: string,
  status: "ready" | "failed" | "skipped",
): Promise<void> {
  const { error } = await supabase
    .from("user_medical_reports")
    .update({ embedding_status: status })
    .eq("id", reportId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function updateReportAnalysis(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  reportId: string,
  userId: string,
  input: {
    analysis: ReportAnalysis;
    provider: string;
    extractionMode: ExtractionMode;
    extractedText?: string | null;
  },
): Promise<UserMedicalReportRow> {
  const isMedical = input.analysis.isMedicalReport !== false;
  const { data, error } = await supabase
    .from("user_medical_reports")
    .update({
      analysis: input.analysis,
      is_medical_report: isMedical,
      risk_level: input.analysis.riskLevel,
      provider: input.provider,
      extraction_mode: input.extractionMode,
      extracted_text: input.extractedText ?? null,
      embedding_status: isMedical ? "pending" : "skipped",
    })
    .eq("id", reportId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to update report");
  return data as UserMedicalReportRow;
}

export async function updateReportStoragePaths(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  reportId: string,
  userId: string,
  storageBucket: string,
  storagePath: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_medical_reports")
    .update({
      storage_bucket: storageBucket,
      storage_path: storagePath,
    })
    .eq("id", reportId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
