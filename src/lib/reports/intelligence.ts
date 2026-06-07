import { chunkText } from "@/lib/rag/chunk-text";
import { embedText } from "@/lib/gemini/embeddings";
import type { ReportAnalysis } from "@/lib/reports/parse-analysis";
import {
  insertUserMedicalReport,
  updateReportEmbeddingStatus,
  type PersistReportInput,
  type UserMedicalReportRow,
} from "@/lib/reports/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function buildReportChunkTexts(input: {
  title: string;
  reportDate: string;
  analysis: ReportAnalysis;
  extractedText?: string | null;
}): string[] {
  const { title, reportDate, analysis, extractedText } = input;
  const parts: string[] = [];

  parts.push(
    [
      `Report: ${title}`,
      `Date: ${reportDate}`,
      `Risk level: ${analysis.riskLevel}`,
      `Summary: ${analysis.summary}`,
      `Explanation: ${analysis.plainExplanation}`,
    ].join("\n"),
  );

  if (analysis.findings.length > 0) {
    const findingsBlock = analysis.findings
      .map(
        (f) =>
          `${f.name}: ${f.value}${f.range ? ` (typical: ${f.range})` : ""} — ${f.status}${f.note ? `. ${f.note}` : ""}`,
      )
      .join("\n");
    parts.push(`Key findings:\n${findingsBlock}`);
  }

  if (analysis.recommendations.length > 0) {
    parts.push(`Recommendations:\n${analysis.recommendations.map((r) => `- ${r}`).join("\n")}`);
  }

  const profileBits = [
    analysis.extractedProfile.conditions.length
      ? `Conditions: ${analysis.extractedProfile.conditions.join(", ")}`
      : "",
    analysis.extractedProfile.allergies.length
      ? `Allergies: ${analysis.extractedProfile.allergies.join(", ")}`
      : "",
    analysis.extractedProfile.medications.length
      ? `Medications: ${analysis.extractedProfile.medications.join(", ")}`
      : "",
    analysis.extractedProfile.notes ? `Notes: ${analysis.extractedProfile.notes}` : "",
  ].filter(Boolean);
  if (profileBits.length) {
    parts.push(`Profile insights:\n${profileBits.join("\n")}`);
  }

  if (extractedText?.trim()) {
    for (const chunk of chunkText(extractedText.trim(), 1800)) {
      parts.push(`Source text excerpt:\n${chunk}`);
    }
  }

  return parts.filter(Boolean);
}

export async function indexReportForRag(input: {
  reportId: string;
  userId: string;
  title: string;
  reportDate: string;
  analysis: ReportAnalysis;
  extractedText?: string | null;
}): Promise<{ chunkCount: number }> {
  const supabase = await createSupabaseServerClient();

  await supabase
    .from("user_medical_report_chunks")
    .delete()
    .eq("report_id", input.reportId)
    .eq("user_id", input.userId);

  const chunkTexts = buildReportChunkTexts(input);
  if (chunkTexts.length === 0) {
    await updateReportEmbeddingStatus(supabase, input.reportId, input.userId, "skipped");
    return { chunkCount: 0 };
  }

  let chunkIndex = 0;
  try {
    for (const content of chunkTexts) {
      const vector = await embedText(content);
      const { error } = await supabase.from("user_medical_report_chunks").insert({
        report_id: input.reportId,
        user_id: input.userId,
        chunk_index: chunkIndex,
        title: chunkIndex === 0 ? input.title : `${input.title} (part ${chunkIndex + 1})`,
        content,
        metadata: {
          reportId: input.reportId,
          reportDate: input.reportDate,
          riskLevel: input.analysis.riskLevel,
        },
        embedding: vector,
      });
      if (error) throw new Error(error.message);
      chunkIndex += 1;
    }
    await updateReportEmbeddingStatus(supabase, input.reportId, input.userId, "ready");
    return { chunkCount: chunkIndex };
  } catch (e) {
    console.error("[report_rag_index]", e);
    await supabase
      .from("user_medical_report_chunks")
      .delete()
      .eq("report_id", input.reportId)
      .eq("user_id", input.userId);
    await updateReportEmbeddingStatus(supabase, input.reportId, input.userId, "failed");
    return { chunkCount: 0 };
  }
}

export async function persistReportIntelligence(
  input: PersistReportInput,
): Promise<{ report: UserMedicalReportRow; indexed: boolean }> {
  const supabase = await createSupabaseServerClient();
  const report = await insertUserMedicalReport(supabase, input);

  const isMedical = input.analysis.isMedicalReport !== false;
  if (!isMedical) {
    return { report, indexed: false };
  }

  const { chunkCount } = await indexReportForRag({
    reportId: report.id,
    userId: input.userId,
    title: report.title,
    reportDate: report.created_at,
    analysis: input.analysis,
    extractedText: input.extractedText,
  });

  return { report, indexed: chunkCount > 0 };
}

export async function reindexReportForRag(report: UserMedicalReportRow): Promise<{ chunkCount: number }> {
  if (!report.is_medical_report) {
    const supabase = await createSupabaseServerClient();
    await updateReportEmbeddingStatus(supabase, report.id, report.user_id, "skipped");
    return { chunkCount: 0 };
  }

  return indexReportForRag({
    reportId: report.id,
    userId: report.user_id,
    title: report.title,
    reportDate: report.created_at,
    analysis: report.analysis,
    extractedText: report.extracted_text,
  });
}
