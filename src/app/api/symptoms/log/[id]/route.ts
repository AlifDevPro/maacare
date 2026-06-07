import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { generateLocalizedAiReply } from "@/lib/ai/generate-localized-reply";
import { buildLanguagePromptLines, normalizeUiLanguagePrior } from "@/lib/ai/language";
import { resolveLanguageFromTextOrPrior } from "@/lib/ai/multilingual-pipeline";
import { composeSystemPrompt } from "@/lib/ai/prompt-composer";
import { enforceNaturalResponseQuality } from "@/lib/ai/quality-guard";
import { buildMedicalSafetyRules, buildNaturalStyleRules, buildSharedIdentityRules } from "@/lib/ai/prompts/shared";
import { planResponseForIntent } from "@/lib/ai/response-planner";
import { executeMcpTool } from "@/lib/ai/mcp/gateway";
import { buildToolCallContext, mcpPlanForRoute } from "@/lib/ai/mcp/policy";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { searchKnowledge } from "@/lib/rag/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

const DESC_TRUNC_RAG = 500;
const DESC_TRUNC_HEURISTIC = 200;

type SymptomLogInsightInput = {
  symptomCodes: string[];
  severity: number | null;
  title: string | null;
  description: string | null;
};

function truncateForDisplay(s: string | null, max: number): string | null {
  const t = s?.trim() ?? "";
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function riskLevelFromSeverity(severity: number | null): "low" | "medium" | "high" {
  if (!severity) return "low";
  if (severity >= 7) return "high";
  if (severity >= 4) return "medium";
  return "low";
}

function buildInsight(input: SymptomLogInsightInput, lang: "en" | "bn"): string {
  const level = riskLevelFromSeverity(input.severity);
  if (lang === "bn") {
    const symptomPart =
      input.symptomCodes.length > 0
        ? `আপনি ${input.symptomCodes.slice(0, 3).join(", ")}${input.symptomCodes.length > 3 ? " এবং আরও কিছু" : ""} উপসর্গ নথিভুক্ত করেছেন।`
        : "আপনি একটি উপসর্গ আপডেট নথিভুক্ত করেছেন।";
    const sevPart =
      input.severity != null
        ? `তীব্রতা ${input.severity}/10, যা ${level === "high" ? "উচ্চ" : level === "medium" ? "মাঝারি" : "নিম্ন"} ঝুঁকির ইঙ্গিত দেয়।`
        : "তীব্রতা উল্লেখ করা হয়নি।";
    const advice =
      level === "high"
        ? "উপসর্গ বাড়লে, স্থায়ী থাকলে, রক্তপাত/তীব্র ব্যথা/শ্বাসকষ্ট হলে জরুরি ভিত্তিতে চিকিৎসকের সাথে যোগাযোগ করুন।"
        : level === "medium"
          ? "আগামী ২৪ ঘণ্টা উপসর্গ পর্যবেক্ষণ করুন এবং সমস্যা থাকলে চিকিৎসকের সাথে যোগাযোগ করুন।"
          : "পানি পান, বিশ্রাম এবং পর্যবেক্ষণ চালিয়ে যান; উপসর্গ বাড়লে আবার লগ করুন।";
    const desc = truncateForDisplay(input.description, DESC_TRUNC_HEURISTIC);
    const notePart = desc ? ` আপনি আরও লিখেছেন: ${desc}` : "";
    return `${symptomPart} ${sevPart} ${advice}${notePart}`;
  }
  const symptomPart =
    input.symptomCodes.length > 0
      ? `You logged ${input.symptomCodes.slice(0, 3).join(", ")}${input.symptomCodes.length > 3 ? " and others" : ""}.`
      : "You logged a symptom update.";
  const sevPart =
    input.severity != null
      ? `Severity is ${input.severity}/10, which looks ${level}.`
      : "Severity was not specified.";
  const advice =
    level === "high"
      ? "Please seek urgent medical guidance if symptoms are worsening, persistent, or include bleeding, severe pain, or breathing difficulty."
      : level === "medium"
        ? "Monitor symptoms closely and contact your provider if this continues over the next 24 hours."
        : "Continue hydration, rest, and observation; re-log if symptoms increase.";
  const desc = truncateForDisplay(input.description, DESC_TRUNC_HEURISTIC);
  const notePart = desc ? ` You also noted: ${desc}` : "";
  return `${symptomPart} ${sevPart} ${advice}${notePart}`;
}

async function fetchRiskRulesContext(
  input: SymptomLogInsightInput,
  englishQueryOverride?: string,
): Promise<string | null> {
  const descQ = truncateForDisplay(input.description, DESC_TRUNC_RAG);
  const query = englishQueryOverride?.trim() || [
    "Pregnancy symptom risk rules and triage guidance.",
    input.title ? `Title: ${input.title}.` : "",
    input.symptomCodes.length > 0 ? `Symptoms: ${input.symptomCodes.join(", ")}.` : "",
    input.severity != null ? `Severity: ${input.severity}/10.` : "",
    descQ ? `User additional notes: ${descQ}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const hits = await searchKnowledge(query.trim(), {
    limit: 5,
    categories: ["risk-rules"],
  });
  if (hits.length === 0) return null;
  return hits
    .map((h, i) => `[${i + 1}] (${h.source ?? "risk-rules"})\n${h.content}`)
    .join("\n\n---\n\n");
}

function buildUserMessageForRag(input: SymptomLogInsightInput): string {
  const desc = truncateForDisplay(input.description, DESC_TRUNC_RAG);
  const parts: string[] = [
    `Symptoms: ${input.symptomCodes.join(", ") || "not specified"}`,
    `Title: ${input.title ?? "n/a"}`,
    `Severity: ${input.severity != null ? `${input.severity}/10` : "n/a"}`,
  ];
  if (desc) parts.push(`Additional notes from user: ${desc}`);
  parts.push(
    "",
    "If additional notes describe symptoms or concerns, incorporate them together with the listed symptoms.",
    "Provide supportive assessment and next-step guidance.",
  );
  return parts.join("\n");
}

async function buildRagRiskInsightFromContext(
  context: string,
  input: SymptomLogInsightInput,
  languageTag: string,
  latestUserMessage: string,
  userStyleHint?: "native_script" | "latin_transliteration" | "mixed_code_switch",
): Promise<string | null> {
  const hasFreeText = Boolean(input.description?.trim());
  const responsePlan = planResponseForIntent({
    intent: {
      family: "symptom_guidance",
      goal: "Give symptom triage guidance",
      responseMode: "answer_with_context",
      confidence: 0.95,
      needsClarification: false,
    },
    ietfLanguageTag: languageTag,
    hasReportContext: false,
    hasNearbyContext: false,
  });
  const systemInstruction = composeSystemPrompt(
    buildSharedIdentityRules(),
    buildMedicalSafetyRules(),
    buildNaturalStyleRules(),
    responsePlan.systemRules,
    "You are a conservative maternal symptom triage assistant.",
    "Use only the provided RISK-RULES context.",
    "Give plain-language guidance in 3-5 sentences.",
    "Do not diagnose. If severe/red-flag risk appears, clearly advise urgent care.",
    hasFreeText
      ? "When the user message includes Additional notes, reflect those details together with the listed symptoms. For concerns not clearly covered by the context, advise the user to discuss them with their clinician without inventing specifics."
      : "",
    buildLanguagePromptLines({ ietfLanguageTag: languageTag }),
    "",
    "RISK-RULES CONTEXT:",
    context,
  );

  const gen = await generateLocalizedAiReply({
    latestUserMessage,
    ietfLanguageTag: languageTag,
    systemInstruction,
    userMessage: buildUserMessageForRag(input),
    userStyleHint,
  });
  const cleaned = enforceNaturalResponseQuality(gen.reply, {
    fallback: "Please monitor symptoms and contact your clinician if concerns continue.",
  });
  return cleaned.trim() || null;
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

async function buildRagSuggestionsFromContext(
  context: string,
  input: SymptomLogInsightInput,
  languageTag: string,
  latestUserMessage: string,
  userStyleHint?: "native_script" | "latin_transliteration" | "mixed_code_switch",
): Promise<string[]> {
  const hasFreeText = Boolean(input.description?.trim());
  const responsePlan = planResponseForIntent({
    intent: {
      family: "symptom_guidance",
      goal: "Generate practical next-step suggestions",
      responseMode: "answer_with_context",
      confidence: 0.95,
      needsClarification: false,
    },
    ietfLanguageTag: languageTag,
    hasReportContext: false,
    hasNearbyContext: false,
  });
  const systemInstruction = composeSystemPrompt(
    buildSharedIdentityRules(),
    buildMedicalSafetyRules(),
    buildNaturalStyleRules(),
    responsePlan.systemRules,
    "You are a conservative maternal symptom triage assistant.",
    "Use only the provided RISK-RULES context.",
    "Return ONLY a JSON array of 3 to 5 strings: short, practical next-step suggestions tailored to this log.",
    "No diagnoses. Prefer hydration, rest, monitoring, and when to escalate to a clinician.",
    hasFreeText
      ? "If the user message includes Additional notes, include at least one suggestion that addresses those notes when relevant."
      : "",
    "Example: [\"Drink water and rest 20 minutes\",\"Track contractions for 1 hour\",\"Call your provider if pain worsens\"]",
    buildLanguagePromptLines({ ietfLanguageTag: languageTag }),
    "",
    "RISK-RULES CONTEXT:",
    context,
  );

  const gen = await generateLocalizedAiReply({
    latestUserMessage,
    ietfLanguageTag: languageTag,
    systemInstruction,
    userMessage: buildUserMessageForRag(input),
    userStyleHint,
  });
  const block = extractJsonArray(gen.reply.trim());
  if (!block) return [];
  try {
    const parsed = JSON.parse(block) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .map((s) => enforceNaturalResponseQuality(s))
      .slice(0, 5);
  } catch {
    return [];
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const parsedId = uuid.safeParse((await context.params).id);
    if (!parsedId.success) return failJson(400, "Invalid symptom log id.");

    const supabase = await createSupabaseServerClient();
    const { data: profileLangRow } = await supabase
      .from("profiles")
      .select("language")
      .eq("id", session.id)
      .maybeSingle();
    const uiLang = normalizeUiLanguagePrior((profileLangRow?.language as string | null) ?? null);
    const { data, error } = await supabase
      .from("symptom_logs")
      .select("id, logged_at, title, description, severity, symptom_codes")
      .eq("id", parsedId.data)
      .eq("user_id", session.id)
      .maybeSingle();

    if (error) {
      console.error("[symptoms/log/id] get:", error);
      return failJson(500, "Could not load symptom log.");
    }
    if (!data) return failJson(404, "Symptom log not found.");

    const symptomCodes = (data.symptom_codes as string[] | null) ?? [];
    const severity = (data.severity as number | null) ?? null;
    const level = riskLevelFromSeverity(severity);
    const title = (data.title as string | null) ?? null;
    const description = (data.description as string | null) ?? null;
    const insightInput: SymptomLogInsightInput = {
      symptomCodes,
      severity,
      title,
      description,
    };
    const userText = [title, description].filter(Boolean).join(" ").trim();
    const langCtx = await resolveLanguageFromTextOrPrior({
      userText: userText || null,
      uiLanguagePrior: uiLang,
    });
    const languageTag = langCtx.ietfLanguageTag;
    const outputLang: "en" | "bn" = languageTag.startsWith("bn") ? "bn" : "en";
    const latestUserMessage = userText || buildUserMessageForRag(insightInput);
    const ragEnglishQuery =
      langCtx.queryExpansion.trim() ||
      langCtx.englishRetrievalQuery.trim() ||
      [
        "Pregnancy symptom risk rules and triage guidance.",
        title ? `Title: ${title}.` : "",
        symptomCodes.length > 0 ? `Symptoms: ${symptomCodes.join(", ")}.` : "",
        severity != null ? `Severity: ${severity}/10.` : "",
        description ? `User additional notes: ${truncateForDisplay(description, DESC_TRUNC_RAG)}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
    const mcpEnabled = process.env.MCP_ENABLED === "1";
    const consentToken = req.nextUrl.searchParams.get("consentToken");
    const mcpReadPlan = mcpPlanForRoute({
      route: "symptom_log_insight",
      intentFamily: "symptom_guidance",
      requestedTools: ["search_medical_knowledge"],
      consentToken,
    });
    const mcpCtx = buildToolCallContext({
      route: "symptom_log_insight",
      intentFamily: "symptom_guidance",
      userId: session.id,
      allowWrites: mcpReadPlan.allowWrites,
      consentToken,
      maxToolCalls: mcpReadPlan.maxToolCalls,
    });
    let insight = buildInsight(insightInput, outputLang);
    let suggestions: string[] = [];
    const mcpTraces: Array<Record<string, unknown>> = [];
    try {
      let ctx: string | null = null;
      if (mcpEnabled && mcpReadPlan.allowedTools.includes("search_medical_knowledge")) {
        const mcpOut = await executeMcpTool({
          name: "search_medical_knowledge",
          args: {
            query: ragEnglishQuery,
            language: languageTag,
            audienceType: "member",
            maxResults: 5,
            categories: ["risk-rules"],
          },
          ctx: mcpCtx,
        });
        mcpTraces.push({
          tool: mcpOut.tool,
          ok: mcpOut.ok,
          error: mcpOut.error,
          trace: mcpOut.trace,
        });
        if (mcpOut.ok && Array.isArray(mcpOut.data?.hits)) {
          const hits = (mcpOut.data.hits as Array<{ source?: string; content?: string }>).filter(Boolean);
          if (hits.length > 0) {
            ctx = hits
              .map((h, i) => `[${i + 1}] (${h.source ?? "risk-rules"})\n${h.content ?? ""}`)
              .join("\n\n---\n\n");
          }
        }
      }
      if (!ctx) ctx = await fetchRiskRulesContext(insightInput, ragEnglishQuery);
      if (ctx) {
        const [ragInsight, ragSuggestions] = await Promise.all([
          buildRagRiskInsightFromContext(
            ctx,
            insightInput,
            languageTag,
            latestUserMessage,
            langCtx.userStyleHint,
          ),
          buildRagSuggestionsFromContext(
            ctx,
            insightInput,
            languageTag,
            latestUserMessage,
            langCtx.userStyleHint,
          ),
        ]);
        if (ragInsight) insight = ragInsight;
        suggestions = ragSuggestions;
      }
      if (mcpEnabled && severity != null && severity >= 8) {
        const writePlan = mcpPlanForRoute({
          route: "symptom_log_insight",
          intentFamily: "symptom_guidance",
          requestedTools: ["log_ai_escalation_event"],
          consentToken,
        });
        const writeCtx = buildToolCallContext({
          route: "symptom_log_insight",
          intentFamily: "symptom_guidance",
          userId: session.id,
          allowWrites: writePlan.allowWrites,
          consentToken,
          maxToolCalls: 1,
        });
        const escalation = await executeMcpTool({
          name: "log_ai_escalation_event",
          args: {
            userId: session.id,
            riskLevel: severity >= 9 ? "high" : "medium",
            reason: `Symptom severity ${severity}/10`,
            routeContext: "symptoms_log_insight",
            consentToken: consentToken ?? undefined,
          },
          ctx: writeCtx,
        });
        mcpTraces.push({
          tool: escalation.tool,
          ok: escalation.ok,
          error: escalation.error,
          trace: escalation.trace,
        });
      }
    } catch (e) {
      console.warn("[symptoms/log/id] risk-rules fallback:", e);
    }

    return Response.json({
      log: {
        id: data.id as string,
        loggedAt: data.logged_at as string,
        title: (data.title as string | null) ?? null,
        description: (data.description as string | null) ?? null,
        severity,
        symptomCodes,
      },
      insight,
      level,
      suggestions,
      ...(process.env.AI_DEBUG_METADATA === "1" ? { debug: { mcpTraces } } : {}),
    });
  } catch (e) {
    return serverErrorJson("symptoms_log_id GET", e);
  }
}

