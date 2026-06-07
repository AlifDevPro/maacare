import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionFromCookies } from "@/lib/auth/get-session";
import {
  buildNearbyFacilitiesContextForChat,
  detectNearbyFacilitiesIntent,
  mergeNearbyIntents,
} from "@/lib/bd-facilities/chat-nearby-context";
import {
  buildLanguagePromptLines,
  normalizeUiLanguagePrior,
  resolveLanguageForTurn,
} from "@/lib/ai/language";
import { detectIntentForTurn } from "@/lib/ai/intent";
import { composeSystemPrompt } from "@/lib/ai/prompt-composer";
import { generateLocalizedAiReply } from "@/lib/ai/generate-localized-reply";
import {
  buildMedicalSafetyRules,
  buildNaturalStyleRules,
  buildSharedIdentityRules,
} from "@/lib/ai/prompts/shared";
import { matchRegressionCase } from "@/lib/ai/regression-cases";
import { planResponseForIntent } from "@/lib/ai/response-planner";
import { executeMcpTool, executeMcpToolsBatch } from "@/lib/ai/mcp/gateway";
import { buildToolCallContext, mcpPlanForRoute } from "@/lib/ai/mcp/policy";
import type { McpToolName } from "@/lib/ai/mcp/types";
import { getGeminiApiKeys, getGroqApiKeys } from "@/lib/gemini/keys";
import { searchKnowledge } from "@/lib/rag/service";
import {
  resolveHealthDataUserId,
  resolvePregnancyUserIdForRequester,
} from "@/lib/app/care-access";
import { persistAiChatTurn } from "@/lib/chat/history-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(12_000),
      }),
    )
    .min(1)
    .max(120),
  reportContext: z.string().max(30_000).optional(),
  /** When set and the user asks about nearby hospitals/pharmacies, BD catalog rows are injected. */
  userLocation: z
    .object({
      latitude: z.number().gte(-90).lte(90),
      longitude: z.number().gte(-180).lte(180),
    })
    .optional(),
  /** Voice mode: shorter, spoken-style replies (no markdown); slightly higher sampling for variety. */
  replyChannel: z.enum(["text", "voice"]).optional().default("text"),
  consentToken: z.string().max(200).optional(),
  requestedAction: z
    .object({
      type: z.enum(["create_care_reminder", "log_ai_escalation_event"]),
      title: z.string().max(140).optional(),
      whenIso: z.string().datetime().optional(),
      reason: z.string().max(500).optional(),
      riskLevel: z.enum(["low", "medium", "high"]).optional(),
    })
    .optional(),
  /** When set, user/assistant turns are persisted to this conversation after a successful reply. */
  conversationId: z.string().uuid().optional(),
});

const MAX_TRANSCRIPT_TOKENS = 2600;
const MAX_MESSAGE_CHARS_IN_TRANSCRIPT = 1200;
const CHAT_PERF_DEBUG = process.env.CHAT_PERF_DEBUG === "1";
const CHAT_LATENCY_OPTIMIZATIONS = process.env.CHAT_LATENCY_OPTIMIZATIONS !== "0";

function line(label: string, value: string | null | undefined): string {
  return `${label}: ${value && value.trim() ? value.trim() : "n/a"}`;
}

function estimateTokens(text: string): number {
  // Practical heuristic for LLM budgeting.
  return Math.ceil(text.length / 4);
}

function findLastUserMessageIndex(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]!.role === "user") return i;
  }
  return -1;
}

function priorAssistantSnippetBefore(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  lastUserIndex: number,
): string | null {
  for (let i = lastUserIndex - 1; i >= 0; i -= 1) {
    const m = messages[i]!;
    if (m.role === "assistant") {
      return m.content.length > 600 ? `${m.content.slice(0, 600)}…` : m.content;
    }
  }
  return null;
}

function computeAgeFromDateOfBirth(dateOfBirthIso: string | null | undefined): number | null {
  if (!dateOfBirthIso) return null;
  const dob = new Date(dateOfBirthIso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

function buildBudgetedTranscript(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  const rows: string[] = [];
  let used = 0;

  // Start from latest and include as much conversation history as fits.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]!;
    const clipped =
      m.content.length > MAX_MESSAGE_CHARS_IN_TRANSCRIPT
        ? `${m.content.slice(0, MAX_MESSAGE_CHARS_IN_TRANSCRIPT)}…`
        : m.content;
    const row = `${m.role === "user" ? "User" : "Assistant"}: ${clipped}`;
    const t = estimateTokens(row);
    if (used + t > MAX_TRANSCRIPT_TOKENS) break;
    rows.unshift(row);
    used += t;
  }

  return rows.join("\n");
}

function nowMs(): number {
  return Date.now();
}

function toFriendlyChatError(err: unknown): {
  status: number;
  message: string;
  retryAfterSeconds?: number;
} {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();
  if (
    msg.includes("all_providers_rate_limited") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("429")
  ) {
    return {
      status: 429,
      message: "AI usage limit is reached right now. Please wait about 1 minute and try again.",
      retryAfterSeconds: 60,
    };
  }
  if (msg.includes("gemini_api_key") || msg.includes("api key")) {
    return {
      status: 503,
      message: "AI service is temporarily unavailable. Please try again shortly.",
    };
  }
  return {
    status: 500,
    message: "Could not generate AI response right now. Please try again in a moment.",
  };
}

function normalizeLoose(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsBanglaScript(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
}

function detectIdentityTargetFromUserTurn(text: string): "assistant" | "user" | "none" {
  const n = normalizeLoose(text);
  if (!n) return "none";
  if (
    /amar nam|আমার নাম|ami ke|আমি কে|who am i|my name/.test(n)
  ) {
    return "user";
  }
  if (
    /tomar nam|tor nam|tumi ke|apni ke|তোমার নাম|আপনার নাম|তুমি কে|আপনি কে|what is your name|who are you/.test(
      n,
    )
  ) {
    return "assistant";
  }
  return "none";
}

function isShortUserTurn(text: string): boolean {
  const n = normalizeLoose(text);
  if (!n) return true;
  const words = n.split(" ").filter(Boolean);
  return words.length <= 5 || n.length <= 22;
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const perfAllStart = nowMs();
    const perf: Record<string, number> = {};
    const markPerf = (key: string, start: number) => {
      if (CHAT_PERF_DEBUG || process.env.AI_DEBUG_METADATA === "1") perf[key] = nowMs() - start;
    };

    const parseStart = nowMs();
    const {
      messages,
      reportContext,
      userLocation,
      replyChannel,
      consentToken,
      requestedAction,
      conversationId: requestConversationId,
    } = bodySchema.parse(await req.json());
    markPerf("parse_ms", parseStart);
    const isVoiceChannel = replyChannel === "voice";
    const supabase = await createSupabaseServerClient();

    if (getGeminiApiKeys().length === 0 && getGroqApiKeys().length === 0) {
      return NextResponse.json(
        { error: "AI service is not configured. Set GEMINI_API_KEY or GROQ_API_KEY." },
        { status: 503 },
      );
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json({ error: "No user message" }, { status: 400 });
    }

    const profileStart = nowMs();
    const profileMini = await supabase
      .from("profiles")
      .select("language, date_of_birth, primary_use_case")
      .eq("id", session.id)
      .maybeSingle();
    markPerf("profile_lookup_ms", profileStart);
    if (profileMini.error) console.warn("[chat] profile:", profileMini.error.message);
    const profileLang = (profileMini.data?.language as string | null) ?? null;
    const uiLanguagePrior = normalizeUiLanguagePrior(profileLang);
    const primaryUseCase = (profileMini.data?.primary_use_case as string | null) ?? null;

    const lastUserIndex = findLastUserMessageIndex(messages);
    const priorAssistantSnippet =
      lastUserIndex >= 0 ? priorAssistantSnippetBefore(messages, lastUserIndex) : null;
    const transcriptStart = nowMs();
    const transcript = buildBudgetedTranscript(messages);
    markPerf("transcript_build_ms", transcriptStart);

    const languageStart = nowMs();
    const languagePrepPromise = resolveLanguageForTurn({
      latestUserMessage: lastUser.content,
      priorAssistantSnippet,
      uiLanguagePrior,
    });

    const careResolveStart = nowMs();
    const careResolvePromise = resolvePregnancyUserIdForRequester(
      supabase,
      session.id,
      primaryUseCase,
    );
    const healthContextPromise = careResolvePromise.then(async ({ pregnancyUserId, activeCare }) => {
      const vitalsUserId = resolveHealthDataUserId(session.id, primaryUseCase, activeCare, "vitals");
      const symptomsUserId = resolveHealthDataUserId(session.id, primaryUseCase, activeCare, "symptoms");
      const [
        pregnancyRes,
        healthRes,
        conditionsRes,
        allergiesRes,
        medsRes,
        vitalsRes,
        symptomRes,
        plannerRes,
        appointmentsRes,
      ] = await Promise.all([
        supabase
          .from("pregnancy_profiles")
          .select("pregnancy_status, gestational_age_weeks, edd_date, risk_flags")
          .eq("user_id", pregnancyUserId)
          .maybeSingle(),
        supabase
          .from("user_health_profiles")
          .select("blood_type, notes, primary_care_provider")
          .eq("user_id", session.id)
          .maybeSingle(),
        supabase
          .from("medical_conditions")
          .select("condition_name, status, severity")
          .eq("user_id", session.id)
          .order("updated_at", { ascending: false })
          .limit(8),
        supabase
          .from("allergies")
          .select("name, allergen_type, severity, reaction")
          .eq("user_id", session.id)
          .order("updated_at", { ascending: false })
          .limit(8),
        supabase
          .from("medications")
          .select("name, dose, frequency, is_active")
          .eq("user_id", session.id)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(8),
        supabase
          .from("vital_signs")
          .select(
            "recorded_at, systolic_bp, diastolic_bp, heart_rate_bpm, weight_kg, temperature_c, glucose_mg_dl, spo2_pct",
          )
          .eq("user_id", vitalsUserId)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("symptom_logs")
          .select("logged_at, title, severity, symptom_codes")
          .eq("user_id", symptomsUserId)
          .order("logged_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("planner_daily_logs")
          .select("plan_date, water_glasses, tasks, completion_percent, completed")
          .eq("user_id", session.id)
          .order("plan_date", { ascending: false })
          .limit(7),
        supabase
          .from("appointments")
          .select("title, status, scheduled_at, provider_name, location")
          .eq("user_id", session.id)
          .order("scheduled_at", { ascending: false })
          .limit(5),
      ]);
      return {
        pregnancyUserId,
        activeCare,
        pregnancyRes,
        healthRes,
        conditionsRes,
        allergiesRes,
        medsRes,
        vitalsRes,
        symptomRes,
        plannerRes,
        appointmentsRes,
      };
    });

    const multilingualPrep = await languagePrepPromise;
    markPerf("language_resolve_ms", languageStart);
    const ietfLanguageTag = multilingualPrep.ietfLanguageTag.trim().toLowerCase() || "en";
    const retrievalQuery = multilingualPrep.englishRetrievalQuery.trim();
    const latestUserOriginal = multilingualPrep.normalizedUserMessage.trim() || lastUser.content.trim();
    if (multilingualPrep.shouldClarifyBeforeRetrieval) {
      const clarification = multilingualPrep.clarificationText?.trim();
      if (clarification) {
        return NextResponse.json({
          reply: clarification,
          provider: "gemini",
          needsClientLocation: false,
          citations: [],
          ...(process.env.AI_DEBUG_METADATA === "1"
            ? {
                debug: {
                  languageTag: ietfLanguageTag,
                  translationConfidence: multilingualPrep.translationConfidence,
                  haltedBeforeRetrieval: true,
                  performance: {
                    ...perf,
                    totalMs: nowMs() - perfAllStart,
                  },
                },
              }
            : {}),
        });
      }
    }
    const identityTarget = detectIdentityTargetFromUserTurn(latestUserOriginal);
    const shortUserTurn = isShortUserTurn(latestUserOriginal);
    const userWroteBanglaScript = containsBanglaScript(latestUserOriginal);
    const latestUserRetrievalQuery = retrievalQuery || latestUserOriginal;
    const retrievalQueryExpanded =
      multilingualPrep.queryExpansion.trim() || latestUserRetrievalQuery;

    const nearbyIntent = mergeNearbyIntents(
      detectNearbyFacilitiesIntent(lastUser.content),
      detectNearbyFacilitiesIntent(latestUserRetrievalQuery),
    );

    const replyLanguageHint =
      multilingualPrep.languageHintForPrompt?.trim() || ietfLanguageTag;
    const intentStart = nowMs();
    const intent = await detectIntentForTurn({
      latestUserMessage: latestUserRetrievalQuery,
      transcriptSnippet: transcript,
      ietfLanguageTag,
    });
    markPerf("intent_detect_ms", intentStart);
    const responsePlan = planResponseForIntent({
      intent,
      ietfLanguageTag,
      hasReportContext: Boolean(reportContext),
      hasNearbyContext: Boolean(nearbyIntent && userLocation),
      voice: isVoiceChannel,
    });
    const ragLimitBase = CHAT_LATENCY_OPTIMIZATIONS
      ? intent.family === "general_health"
        ? 6
        : intent.family === "symptom_guidance"
          ? 6
          : intent.family === "planning"
            ? 5
            : 4
      : 8;
    const ragLimit = Math.max(ragLimitBase, multilingualPrep.retrievalCandidateSize);
    const mcpEnabled = process.env.MCP_ENABLED === "1";
    const mcpRequestedReadTools: McpToolName[] = [];
    if (responsePlan.allowedToolFamilies.includes("knowledge") && responsePlan.shouldRetrieveKnowledge) {
      mcpRequestedReadTools.push("search_medical_knowledge");
    }
    if (responsePlan.allowedToolFamilies.includes("facilities") && nearbyIntent && userLocation) {
      mcpRequestedReadTools.push("get_nearby_facilities");
    }
    const mcpPlan = mcpPlanForRoute({
      route: "chat",
      intentFamily: intent.family,
      requestedTools: mcpRequestedReadTools,
      consentToken,
    });
    const mcpCtx = buildToolCallContext({
      route: "chat",
      intentFamily: intent.family,
      userId: session.id,
      sessionName: session.name ?? null,
      allowWrites: mcpPlan.allowWrites,
      consentToken,
      maxToolCalls: Math.min(responsePlan.maxToolCalls, mcpPlan.maxToolCalls),
    });
    const mcpStart = nowMs();
    const mcpReadBatch = mcpEnabled
      ? await executeMcpToolsBatch({
          ctx: mcpCtx,
          calls: mcpPlan.allowedTools.map((toolName) => {
            if (toolName === "search_medical_knowledge") {
              return {
                name: toolName,
                args: {
                  query: retrievalQueryExpanded,
                  language: ietfLanguageTag,
                  audienceType: "member",
                  maxResults: ragLimit,
                },
              };
            }
            return {
              name: toolName,
              args: {
                lat: userLocation!.latitude,
                lng: userLocation!.longitude,
              },
            };
          }),
        })
      : { results: [], traces: [] };
    markPerf("mcp_tools_ms", mcpStart);
    const mcpKnowledgeResult = CHAT_LATENCY_OPTIMIZATIONS
      ? mcpReadBatch.results.find((r) => r.tool === "search_medical_knowledge" && r.ok)
      : null;
    const mcpNearbyResult = CHAT_LATENCY_OPTIMIZATIONS
      ? mcpReadBatch.results.find((r) => r.tool === "get_nearby_facilities" && r.ok)
      : null;
    const mcpReadContextBlock =
      mcpReadBatch.results.length > 0
        ? [
            "MCP TOOL CONTEXT:",
            ...mcpReadBatch.results.map((r) =>
              r.ok
                ? `${r.tool}: ${JSON.stringify(r.data ?? {})}`
                : `${r.tool}: unavailable (${r.error ?? "unknown_error"})`,
            ),
          ].join("\n")
        : "";

    const ragStart = nowMs();
    const hits = Array.isArray(mcpKnowledgeResult?.data?.hits)
      ? (mcpKnowledgeResult.data.hits as Array<{
          id: string;
          score: number;
          content: string;
          title?: string;
          source?: string;
          category?: string;
        }>)
      : responsePlan.shouldRetrieveKnowledge
        ? await searchKnowledge(retrievalQueryExpanded, {
            limit: ragLimit,
            cacheTtlMs: CHAT_LATENCY_OPTIMIZATIONS ? 30_000 : 0,
          })
        : [];
    markPerf("rag_ms", ragStart);
    const context =
      hits.length > 0
        ? hits
            .map((h, i) => `[${i + 1}] (${h.source ?? "source"}${h.category ? ` · ${h.category}` : ""})\n${h.content}`)
            .join("\n\n---\n\n")
        : responsePlan.shouldRetrieveKnowledge
          ? "(No matching internal articles were retrieved; answer generally and recommend professional care when unsure.)"
          : "(Knowledge retrieval intentionally skipped for this intent. Answer directly and naturally.)";
    const dbStart = nowMs();
    const {
      activeCare,
      pregnancyRes,
      healthRes,
      conditionsRes,
      allergiesRes,
      medsRes,
      vitalsRes,
      symptomRes,
      plannerRes,
      appointmentsRes,
    } = await healthContextPromise;
    markPerf("care_resolve_ms", careResolveStart);
    markPerf("health_context_db_ms", dbStart);

    if (pregnancyRes.error) console.warn("[chat] pregnancy:", pregnancyRes.error.message);
    if (healthRes.error) console.warn("[chat] health:", healthRes.error.message);
    if (conditionsRes.error) console.warn("[chat] conditions:", conditionsRes.error.message);
    if (allergiesRes.error) console.warn("[chat] allergies:", allergiesRes.error.message);
    if (medsRes.error) console.warn("[chat] medications:", medsRes.error.message);
    if (vitalsRes.error) console.warn("[chat] vitals:", vitalsRes.error.message);
    if (symptomRes.error) console.warn("[chat] symptoms:", symptomRes.error.message);
    if (plannerRes.error) console.warn("[chat] planner:", plannerRes.error.message);
    if (appointmentsRes.error) console.warn("[chat] appointments:", appointmentsRes.error.message);

    const conditions =
      (conditionsRes.data ?? []).map(
        (c) =>
          `${String(c.condition_name)} (${String(c.status ?? "n/a")}${c.severity ? `, ${String(c.severity)}` : ""})`,
      ) ?? [];
    const allergies =
      (allergiesRes.data ?? []).map(
        (a) =>
          `${String(a.name)} (${String(a.allergen_type ?? "other")}${a.severity ? `, ${String(a.severity)}` : ""}${a.reaction ? `, reaction: ${String(a.reaction)}` : ""})`,
      ) ?? [];
    const meds =
      (medsRes.data ?? []).map(
        (m) =>
          `${String(m.name)}${m.dose ? ` ${String(m.dose)}` : ""}${m.frequency ? `, ${String(m.frequency)}` : ""}`,
      ) ?? [];
    const dateOfBirth = (profileMini.data?.date_of_birth as string | null) ?? null;
    const age = computeAgeFromDateOfBirth(dateOfBirth);
    const recentPlannerSummary =
      (plannerRes.data ?? [])
        .slice(0, 3)
        .map((p) => {
          const rawTasks = (p.tasks as Record<string, boolean> | null) ?? {};
          const doneTaskCount = Object.values(rawTasks).filter(Boolean).length;
          return `${String(p.plan_date)}: ${Number(p.completion_percent ?? 0)}% complete, water ${Number(p.water_glasses ?? 0)}/8, tasks done ${doneTaskCount}${p.completed ? " (marked complete)" : ""}`;
        })
        .join(" | ") || null;
    const recentAppointmentsSummary =
      (appointmentsRes.data ?? [])
        .slice(0, 3)
        .map(
          (a) =>
            `${String(a.title ?? "Appointment")} (${String(a.status ?? "unknown")}) at ${String(a.scheduled_at ?? "n/a")}${a.provider_name ? ` with ${String(a.provider_name)}` : ""}${a.location ? `, ${String(a.location)}` : ""}`,
        )
        .join(" | ") || null;

    const personalContext = [
      "PERSONAL HEALTH CONTEXT (use only for personalization; do not expose sensitive details unnecessarily):",
      line("User profile name", session.name ?? null),
      line("Member email", session.email ?? null),
      line("Date of birth", dateOfBirth),
      line("Age (computed from DOB)", age != null ? String(age) : null),
      line(
        "Care link",
        activeCare ? "Pregnancy/vitals context may reflect a linked family member you support." : null,
      ),
      line("Pregnancy status", pregnancyRes.data?.pregnancy_status as string | null),
      line(
        "Gestational week",
        pregnancyRes.data?.gestational_age_weeks != null
          ? String(pregnancyRes.data.gestational_age_weeks)
          : null,
      ),
      line("Estimated due date", (pregnancyRes.data?.edd_date as string | null) ?? null),
      line(
        "Risk flags",
        Array.isArray(pregnancyRes.data?.risk_flags)
          ? pregnancyRes.data?.risk_flags.join(", ")
          : null,
      ),
      line("Blood type", (healthRes.data?.blood_type as string | null) ?? null),
      line(
        "Primary care provider",
        (healthRes.data?.primary_care_provider as string | null) ?? null,
      ),
      line(
        "Latest vitals",
        vitalsRes.data
          ? [
              vitalsRes.data.systolic_bp != null && vitalsRes.data.diastolic_bp != null
                ? `BP ${vitalsRes.data.systolic_bp}/${vitalsRes.data.diastolic_bp}`
                : null,
              vitalsRes.data.heart_rate_bpm != null ? `HR ${vitalsRes.data.heart_rate_bpm}` : null,
              vitalsRes.data.spo2_pct != null ? `SpO2 ${vitalsRes.data.spo2_pct}%` : null,
              vitalsRes.data.temperature_c != null ? `Temp ${vitalsRes.data.temperature_c} C` : null,
            ]
              .filter(Boolean)
              .join(", ")
          : null,
      ),
      line(
        "Latest symptom log",
        symptomRes.data
          ? `${symptomRes.data.title ?? "Symptom check"}; severity ${symptomRes.data.severity ?? "n/a"}`
          : null,
      ),
      line("Recent planner activity (hydration/meals/walk/tasks)", recentPlannerSummary),
      line("Recent appointments", recentAppointmentsSummary),
      line("Active conditions", conditions.length ? conditions.join("; ") : null),
      line("Allergies", allergies.length ? allergies.join("; ") : null),
      line("Active medications", meds.length ? meds.join("; ") : null),
      line("Health notes", (healthRes.data?.notes as string | null) ?? null),
    ].join("\n");

    const nearbyStart = nowMs();
    let nearbyFacilitiesText = "";
    if (nearbyIntent) {
      if (userLocation) {
        if (typeof mcpNearbyResult?.data?.catalogText === "string") {
          nearbyFacilitiesText = mcpNearbyResult.data.catalogText;
        } else {
          nearbyFacilitiesText = await buildNearbyFacilitiesContextForChat(supabase, {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            intent: nearbyIntent,
          });
        }
      } else {
        nearbyFacilitiesText = [
          "The user’s message suggests they want nearby hospitals or pharmacies, but no GPS coordinates were sent yet.",
          "Reply in ONE short, warm sentence: a popup will ask them to allow location so you can list nearby options.",
          "Do NOT tell them to send their question again or type “I shared location” — the app will automatically continue this conversation with GPS right after they allow permission.",
        ].join(" ");
      }
    }
    markPerf("nearby_context_ms", nearbyStart);

    let reportContextText = "";
    if (reportContext) {
      try {
        const parsed = JSON.parse(reportContext) as {
          title?: string;
          summary?: string;
          plainExplanation?: string;
          findings?: Array<{ name?: string; value?: string; status?: string }>;
          recommendations?: string[];
        };
        reportContextText = [
          "REPORT CONTEXT (user just came from report analysis):",
          `Title: ${parsed.title ?? "Medical report"}`,
          `Summary: ${parsed.summary ?? "n/a"}`,
          `Explanation: ${parsed.plainExplanation ?? "n/a"}`,
          `Findings: ${
            Array.isArray(parsed.findings)
              ? parsed.findings
                  .slice(0, 12)
                  .map((f) => `${f.name ?? "marker"}=${f.value ?? "n/a"} (${f.status ?? "n/a"})`)
                  .join("; ")
              : "n/a"
          }`,
          `Recommendations: ${
            Array.isArray(parsed.recommendations)
              ? parsed.recommendations.slice(0, 8).join("; ")
              : "n/a"
          }`,
        ].join("\n");
      } catch {
        reportContextText = "";
      }
    }

    const voiceSpeechBlock = isVoiceChannel
      ? [
          "",
          "VOICE / SPOKEN OUTPUT MODE (this reply will be read aloud by text-to-speech):",
          "Write plain speech only: no markdown, no bullet lists, no asterisks, no headings, no links.",
          "Keep it brief by default: about one to three short sentences unless the user clearly asks for more detail.",
          "Sound warm and conversational: you may rarely start with a tiny natural filler like “Mm,” or “Okay—” but do not overuse fillers or sound theatrical.",
          "If the user only greets you (e.g. hi/hello again), answer in one short friendly line—do not repeat a long introduction you already gave earlier in the thread.",
          "Vary wording across turns; avoid sounding scripted or identical to your previous reply.",
          "Still include the usual safety framing when giving health-related guidance (informational, not diagnosis)—keep that part concise for speech.",
        ]
      : [];

    const systemInstructionBase = composeSystemPrompt(
      buildSharedIdentityRules(),
      buildMedicalSafetyRules(),
      buildNaturalStyleRules({ voice: isVoiceChannel }),
      responsePlan.systemRules,
      `Current detected intent family: ${intent.family}.`,
      `Current response mode: ${responsePlan.mode}.`,
      `Target max sentence count: ${responsePlan.maxSentences}.`,
      "MaaCare knowledge includes trusted admin-managed sources and user-specific health context.",
      "Translation-sandwich contract: internal retrieval, tool planning, and grounding run in English; user-facing answer must follow the target language instruction.",
      "Do not say or imply that global knowledge was uploaded by this user.",
      "Only mention user-uploaded content when REPORT CONTEXT is explicitly provided in this request.",
      "Ground answers in the provided CONTEXT when it is relevant. If CONTEXT is insufficient, say so clearly.",
      "Personalize guidance using PERSONAL HEALTH CONTEXT when relevant to the user question.",
      "Address the user by first name naturally when appropriate (not every sentence).",
      "Never claim the user's profile name as your own identity.",
      responsePlan.directAnswerFirst
        ? "For this turn, first sentence must directly answer the user's literal question."
        : "",
      responsePlan.avoidOpeningSmallTalk
        ? "Do not open with greetings, fillers, or social preface before the direct answer."
        : "",
      identityTarget === "assistant"
        ? "The user asks assistant identity; answer that you are MaaCare in the first sentence."
        : "",
      identityTarget === "user"
        ? "The user asks their own identity/name; if USER profile name is available, answer with that directly in the first sentence."
        : "",
      ietfLanguageTag.startsWith("bn") && userWroteBanglaScript
        ? "Use Bangla script (বাংলা) for output; avoid switching to Roman Bangla."
        : "",
      ietfLanguageTag.startsWith("bn") && !userWroteBanglaScript
        ? "Use Romanized Bangla in Latin script to match the user's writing style."
        : "",
      "If personal context is missing for a needed decision, ask a brief clarifying question.",
      "Always prioritize the LATEST USER TURN intent over earlier turns.",
      "If latest turn is a short acknowledgement, continue naturally from the immediate prior context.",
      ...buildLanguagePromptLines({
        ietfLanguageTag,
        languageHintForPrompt: replyLanguageHint,
        userStyleHint: multilingualPrep.userStyleHint,
      }),
      ...voiceSpeechBlock,
      "",
      personalContext,
      "",
      reportContextText ? `${reportContextText}\n` : "",
      nearbyFacilitiesText ? `${nearbyFacilitiesText}\n` : "",
      mcpReadContextBlock ? `${mcpReadContextBlock}\n` : "",
      "CONTEXT (retrieved articles):",
      context,
    );

    const userMessage = [
      "LATEST USER TURN (original):",
      latestUserOriginal || "(empty)",
      "",
      "LATEST USER TURN (English retrieval query for embedding / RAG):",
      latestUserRetrievalQuery || "(empty)",
      "",
      "LATEST USER TURN (expanded retrieval query):",
      retrievalQueryExpanded || "(empty)",
      "",
      "Conversation so far:",
      transcript,
      "",
      "Use BOTH latest-turn versions to understand intent.",
      "Generate one final answer in the user's language as defined in the system instructions (IETF tag and hints).",
      "Do not mention translation or retrieval preparation steps.",
    ].join("\n");

    const generationStart = nowMs();
    const qualityRun = await generateLocalizedAiReply({
      latestUserMessage: latestUserOriginal,
      ietfLanguageTag,
      systemInstruction: composeSystemPrompt(systemInstructionBase),
      userMessage,
      ...(isVoiceChannel ? { temperature: 0.82 } : {}),
      minChars: responsePlan.mode === "ask_clarification" ? 8 : 16,
      userStyleHint: multilingualPrep.userStyleHint,
      alignment: {
        shortQuery: shortUserTurn,
        identityTarget,
        userName: session.name ?? null,
      },
      recoveryRule:
        "Quality correction pass: answer directly, keep natural tone, do not echo user text, and never claim the user's profile name as your own. If asked identity, say you are MaaCare.",
    });
    const providerUsed = qualityRun.provider;
    markPerf("generation_with_quality_ms", generationStart);

    const needsClientLocation = Boolean(nearbyIntent && !userLocation);
    let mcpActionResult: {
      tool: McpToolName;
      ok: boolean;
      error: string | null;
      data: Record<string, unknown> | null;
    } | null = null;
    if (mcpEnabled && requestedAction) {
      const toolName: McpToolName = requestedAction.type;
      const writePolicy = mcpPlanForRoute({
        route: "chat",
        intentFamily: intent.family,
        requestedTools: [toolName],
        consentToken,
      });
      const writeCtx = buildToolCallContext({
        route: "chat",
        intentFamily: intent.family,
        userId: session.id,
        sessionName: session.name ?? null,
        allowWrites: writePolicy.allowWrites,
        consentToken,
        maxToolCalls: 1,
      });
      const writeArgs =
        toolName === "create_care_reminder"
          ? {
              userId: session.id,
              title: requestedAction.title ?? "MaaCare care reminder",
              timeIso: requestedAction.whenIso ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              channel: "in_app",
              consentToken: consentToken ?? "",
            }
          : {
              userId: session.id,
              riskLevel: requestedAction.riskLevel ?? "medium",
              reason: requestedAction.reason ?? "User-triggered escalation event",
              routeContext: "chat",
              consentToken: consentToken ?? "",
            };
      const writeOut = await executeMcpTool({
        name: toolName,
        args: writeArgs,
        ctx: writeCtx,
      });
      mcpActionResult = {
        tool: toolName,
        ok: writeOut.ok,
        error: writeOut.error,
        data: writeOut.data,
      };
    }

    const debugMeta =
      process.env.AI_DEBUG_METADATA === "1"
        ? {
            regressionCase: (() => {
              const m = matchRegressionCase(latestUserOriginal);
              if (!m) return null;
              return {
                key: m.key,
                expectedIntentFamily: m.expectedIntentFamily,
                intentMatched: m.expectedIntentFamily === intent.family,
              };
            })(),
            languageTag: ietfLanguageTag,
            translationConfidence: multilingualPrep.translationConfidence,
            detectorSource: multilingualPrep.detectorSource,
            translatorSource: multilingualPrep.translatorSource,
            englishRetrievalQuery: latestUserRetrievalQuery,
            retrievalQuery: latestUserRetrievalQuery,
            retrievalQueryExpanded,
            postProcessed: qualityRun.postProcessed,
            intentFamily: intent.family,
            intentConfidence: intent.confidence,
            responseMode: responsePlan.mode,
            identityTarget,
            qualityRetried: qualityRun.retried,
            qualityReasons: qualityRun.quality.reasons,
            mcpTools: mcpReadBatch.traces,
            mcpDeniedReason: mcpPlan.deniedReason,
            mcpAction: mcpActionResult,
            latencyOptimizations: CHAT_LATENCY_OPTIMIZATIONS,
            performance: {
              ...perf,
              totalMs: nowMs() - perfAllStart,
            },
          }
        : undefined;

    let persistedConversationId: string | undefined;
    if (!needsClientLocation) {
      try {
        let reportContextJson: unknown;
        if (reportContext) {
          try {
            reportContextJson = JSON.parse(reportContext);
          } catch {
            reportContextJson = { raw: reportContext };
          }
        }

        persistedConversationId = await persistAiChatTurn(supabase, {
          userId: session.id,
          conversationId: requestConversationId,
          userContent: lastUser.content,
          assistantContent: qualityRun.reply,
          reportContext: reportContextJson,
          userMetadata: {
            ietfLanguageTag,
            englishRetrievalQuery: latestUserRetrievalQuery,
            detectorSource: multilingualPrep.detectorSource,
            translatorSource: multilingualPrep.translatorSource,
          },
          metadata: {
            provider: providerUsed,
            citationCount: hits.length,
            ietfLanguageTag,
            englishRetrievalQuery: latestUserRetrievalQuery,
            detectorSource: multilingualPrep.detectorSource,
            translatorSource: multilingualPrep.translatorSource,
            postProcessed: qualityRun.postProcessed,
          },
        });
      } catch (persistErr) {
        console.warn("[chat] history persist failed:", persistErr);
      }
    }

    return NextResponse.json({
      reply: qualityRun.reply,
      provider: providerUsed,
      needsClientLocation,
      ...(persistedConversationId ? { conversationId: persistedConversationId } : {}),
      ...(mcpActionResult ? { action: mcpActionResult } : {}),
      ...(debugMeta ? { debug: debugMeta } : {}),
      citations: hits.map((h) => ({
        id: h.id,
        score: h.score,
        title: h.title,
        source: h.source,
        category: h.category,
        excerpt: h.content.slice(0, 280),
      })),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error(err);
    const friendly = toFriendlyChatError(err);
    return NextResponse.json(
      {
        error: friendly.message,
        ...(friendly.retryAfterSeconds ? { retryAfterSeconds: friendly.retryAfterSeconds } : {}),
      },
      { status: friendly.status },
    );
  }
}
