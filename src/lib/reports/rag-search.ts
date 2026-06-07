import { embedText } from "@/lib/gemini/embeddings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserReportSearchHit = {
  id: string;
  reportId: string;
  reportTitle: string;
  reportDate: string;
  score: number;
  content: string;
  title?: string;
  chunkIndex: number;
};

type MatchRow = {
  chunk_id: string;
  report_id: string;
  report_title: string;
  report_date: string;
  content: string;
  title: string | null;
  chunk_index: number;
  similarity: number;
};

const REPORT_QUERY_RE =
  /\b(my|previous|latest|last|earlier|uploaded|past)\s+(report|lab|test|result|blood|scan|ultrasound|cholesterol|glucose|hemoglobin|hb|cbc|thyroid|vitamin|report's)\b|\b(compare|comparison|trend|over time|between reports|from my report|in my report|report says|lab result|test result|blood test|lab report)\b|\b(cholesterol|ldl|hdl|triglyceride|hemoglobin|platelet|wbc|rbc|creatinine|alt|ast|tsh|a1c|hba1c)\b/i;

export function shouldSearchUserReports(query: string, intentFamily?: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (intentFamily === "report_explanation") return true;
  if (REPORT_QUERY_RE.test(q)) return true;
  return false;
}

export async function searchUserReports(
  userId: string,
  query: string,
  options?: { limit?: number; minSimilarity?: number },
): Promise<UserReportSearchHit[]> {
  const supabase = await createSupabaseServerClient();
  const vector = await embedText(query);
  const limit = Math.max(1, Math.min(12, options?.limit ?? 6));
  const minSimilarity = options?.minSimilarity ?? 0.08;

  const { data, error } = await supabase.rpc("match_user_report_chunks", {
    p_user_id: userId,
    query_embedding: vector,
    match_count: limit,
    min_similarity: minSimilarity,
  });

  if (error) {
    console.warn("[searchUserReports]", error.message);
    return [];
  }

  const rows = (data ?? []) as MatchRow[];
  return rows.map((r) => ({
    id: r.chunk_id,
    reportId: r.report_id,
    reportTitle: r.report_title,
    reportDate: r.report_date,
    score: r.similarity,
    content: r.content,
    title: r.title ?? undefined,
    chunkIndex: r.chunk_index,
  }));
}

export function formatUserReportHitsForPrompt(hits: UserReportSearchHit[]): string {
  if (!hits.length) {
    return "(No matching uploaded reports were found for this user.)";
  }
  return hits
    .map((h, i) => {
      const date = new Date(h.reportDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      return `[${i + 1}] ${h.reportTitle} · ${date}\n${h.content}`;
    })
    .join("\n\n---\n\n");
}
