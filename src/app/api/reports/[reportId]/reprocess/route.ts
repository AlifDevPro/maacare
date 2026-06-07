import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { buildLanguagePromptLines, normalizeUiLanguagePrior } from "@/lib/ai/language";
import { postProcessMultilingualReply, resolveLanguageFromTextOrPrior } from "@/lib/ai/multilingual-pipeline";
import { enforceNaturalResponseQuality } from "@/lib/ai/quality-guard";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { getGeminiApiKeys, getGroqApiKeys } from "@/lib/gemini/keys";
import { generateWithGroq, getGroqReportModelName, isRateLimitError } from "@/lib/gemini/text-failover";
import { clipReportText } from "@/lib/reports/extraction";
import { reindexReportForRag } from "@/lib/reports/intelligence";
import {
  getUserMedicalReport,
  updateReportAnalysis,
} from "@/lib/reports/repository";
import {
  parseReportAnalysisFromModelText,
  sanitizeReportAnalysis,
} from "@/lib/reports/parse-analysis";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteParams = { params: Promise<{ reportId: string }> };

export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Please sign in and try again.");

    const geminiKeys = getGeminiApiKeys();
    const groqKeys = getGroqApiKeys();
    if (geminiKeys.length === 0 && groqKeys.length === 0) {
      return failJson(503, "This feature isn't available right now. Please try again later.");
    }

    const { reportId } = await params;
    const supabase = await createSupabaseServerClient();
    const existing = await getUserMedicalReport(supabase, session.id, reportId);
    if (!existing) return failJson(404, "Report not found.");

    const sourceText = (existing.extracted_text ?? "").trim();
    if (!sourceText) {
      return failJson(400, "This report has no saved text to re-process.");
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("language")
      .eq("id", session.id)
      .maybeSingle();
    const uiLang = normalizeUiLanguagePrior((profileRow?.language as string | null) ?? null);
    const langCtx = await resolveLanguageFromTextOrPrior({
      userText: sourceText,
      uiLanguagePrior: uiLang,
    });
    const languageBlock = buildLanguagePromptLines({
      ietfLanguageTag: langCtx.ietfLanguageTag,
      languageHintForPrompt: langCtx.languageHintForPrompt,
      userStyleHint: langCtx.userStyleHint,
    });

    const systemInstruction = [
      "You are MaaCare report simplifier.",
      "Return STRICT JSON with isMedicalReport, summary, plainExplanation, riskLevel, findings, recommendations, extractedVitals, extractedProfile.",
      ...languageBlock,
    ].join("\n");

    const userMessage = `Re-analyze this medical report text:\n${clipReportText(sourceText)}`;
    let rawText = "";
    let provider: "gemini" | "groq" = "gemini";

    for (const key of geminiKeys) {
      try {
        const model = new GoogleGenerativeAI(key).getGenerativeModel({
          model: process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash",
          systemInstruction,
        });
        rawText = (await model.generateContent(userMessage)).response.text().trim();
        if (rawText) break;
      } catch {
        /* try next */
      }
    }

    if (!rawText && groqKeys.length > 0) {
      for (const key of groqKeys) {
        try {
          rawText = await generateWithGroq(key, systemInstruction, userMessage, {
            model: getGroqReportModelName(),
            temperature: 0.2,
          });
          provider = "groq";
          break;
        } catch (e) {
          if (!isRateLimitError(String(e))) break;
        }
      }
    }

    const parsed = rawText ? parseReportAnalysisFromModelText(rawText) : null;
    if (!parsed) return failJson(500, "Could not re-process this report.");

    const [summaryPost, explanationPost] = await Promise.all([
      postProcessMultilingualReply({
        reply: parsed.summary,
        latestUserMessage: sourceText,
        ietfLanguageTag: langCtx.ietfLanguageTag,
        userStyleHint: langCtx.userStyleHint,
      }),
      postProcessMultilingualReply({
        reply: parsed.plainExplanation,
        latestUserMessage: sourceText,
        ietfLanguageTag: langCtx.ietfLanguageTag,
        userStyleHint: langCtx.userStyleHint,
      }),
    ]);

    const cleaned = sanitizeReportAnalysis({
      ...parsed,
      summary: enforceNaturalResponseQuality(summaryPost.reply),
      plainExplanation: enforceNaturalResponseQuality(explanationPost.reply),
    });

    const updated = await updateReportAnalysis(supabase, reportId, session.id, {
      analysis: cleaned,
      provider,
      extractionMode: "provided_text",
      extractedText: sourceText,
    });

    await reindexReportForRag(updated);

    return Response.json({ report: updated });
  } catch (e) {
    return serverErrorJson("reports/[reportId]/reprocess POST", e);
  }
}
