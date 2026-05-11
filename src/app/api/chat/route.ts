import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionFromCookies } from "@/lib/auth/get-session";
import {
  buildNearbyFacilitiesContextForChat,
  detectNearbyFacilitiesIntent,
} from "@/lib/bd-facilities/chat-nearby-context";
import { getGeminiApiKeys, getGroqApiKeys } from "@/lib/gemini/keys";
import { generateTextWithGeminiGroqFailover } from "@/lib/gemini/text-failover";
import { searchKnowledge } from "@/lib/rag/service";
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
});

const MAX_TRANSCRIPT_TOKENS = 2600;
const MAX_MESSAGE_CHARS_IN_TRANSCRIPT = 1200;
const BANGLA_CHAR_RE = /[\u0980-\u09FF]/;
const BANGLISH_HINT_WORDS = new Set([
  "ami",
  "apni",
  "tumi",
  "amar",
  "tomar",
  "ki",
  "kemon",
  "kibhabe",
  "kivabe",
  "keno",
  "hobe",
  "hoy",
  "hocche",
  "korbo",
  "korchi",
  "korle",
  "khabo",
  "khawa",
  "ghum",
  "pani",
  "pete",
  "byatha",
  "matha",
  "baccha",
  "bacha",
  "soptaho",
  "mas",
  "jonno",
  "valo",
  "bhalo",
  "nai",
  "ache",
  "ase",
  "nibo",
  "parbo",
  "dorkar",
  "doctor",
]);

function line(label: string, value: string | null | undefined): string {
  return `${label}: ${value && value.trim() ? value.trim() : "n/a"}`;
}

function estimateTokens(text: string): number {
  // Practical heuristic for LLM budgeting.
  return Math.ceil(text.length / 4);
}

function detectPreferredReplyLanguage(text: string): "bn" | "en" {
  return BANGLA_CHAR_RE.test(text) || isLikelyBanglish(text) ? "bn" : "en";
}

function normalizeForIntent(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAskMyName(text: string): boolean {
  const t = normalizeForIntent(text);
  return (
    /\bwhat is my name\b/.test(t) ||
    /\bmy name\b/.test(t) ||
    /\bamar nam\b/.test(t) ||
    /আমার নাম/.test(text)
  );
}

function isAskWhatYouKnowAboutMe(text: string): boolean {
  const t = normalizeForIntent(text);
  return (
    /\bwhat do you know about me\b/.test(t) ||
    /\babout me\b/.test(t) ||
    /\bamar bisoy\b/.test(t) ||
    /\bamar bishoy\b/.test(t) ||
    /\bamar somporke\b/.test(t) ||
    /আমার\s*(বিষ|বিস|সম্পর্কে)/.test(text)
  );
}

function isLikelyBanglish(text: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();
  // If native Bangla is present, this detector is not needed.
  if (BANGLA_CHAR_RE.test(normalized)) return false;

  const tokens = normalized.match(/[a-z]+/g) ?? [];
  if (tokens.length < 3) return false;
  let hits = 0;
  for (const t of tokens) {
    if (BANGLISH_HINT_WORDS.has(t)) hits += 1;
  }
  // Require at least 2 strong hints to reduce false positives.
  return hits >= 2;
}

async function normalizeQueryForEnglishRetrieval(
  query: string,
  opts?: { forceTranslate?: boolean },
): Promise<string> {
  const trimmed = query.trim();
  if (!trimmed) return trimmed;
  const shouldTranslate = opts?.forceTranslate ?? BANGLA_CHAR_RE.test(trimmed);
  if (!shouldTranslate) return trimmed;

  const out = await generateTextWithGeminiGroqFailover({
    systemInstruction: [
      "You translate Bangla user questions into concise English for semantic retrieval.",
      "Return only the translated English query text.",
      "Do not answer the question and do not add extra explanation.",
    ].join("\n"),
    userMessage: trimmed,
  });
  return out.text.trim() || trimmed;
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

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, reportContext, userLocation } = bodySchema.parse(await req.json());
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

    const preferredReplyLanguage = detectPreferredReplyLanguage(lastUser.content);
    const retrievalQuery = await normalizeQueryForEnglishRetrieval(lastUser.content, {
      forceTranslate: preferredReplyLanguage === "bn",
    });
    const latestUserOriginal = lastUser.content.trim();
    const latestUserEnglish = retrievalQuery.trim();

    const hits = await searchKnowledge(retrievalQuery, {
      limit: 8,
    });
    const context =
      hits.length > 0
        ? hits
            .map((h, i) => `[${i + 1}] (${h.source ?? "source"}${h.category ? ` · ${h.category}` : ""})\n${h.content}`)
            .join("\n\n---\n\n")
        : "(No matching internal articles were retrieved; answer generally and recommend professional care when unsure.)";

    const [
      pregnancyRes,
      healthRes,
      conditionsRes,
      allergiesRes,
      medsRes,
      vitalsRes,
      symptomRes,
    ] = await Promise.all([
      supabase
        .from("pregnancy_profiles")
        .select("pregnancy_status, gestational_age_weeks, edd_date, risk_flags")
        .eq("user_id", session.id)
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
        .eq("user_id", session.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("symptom_logs")
        .select("logged_at, title, severity, symptom_codes")
        .eq("user_id", session.id)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (pregnancyRes.error) console.warn("[chat] pregnancy:", pregnancyRes.error.message);
    if (healthRes.error) console.warn("[chat] health:", healthRes.error.message);
    if (conditionsRes.error) console.warn("[chat] conditions:", conditionsRes.error.message);
    if (allergiesRes.error) console.warn("[chat] allergies:", allergiesRes.error.message);
    if (medsRes.error) console.warn("[chat] medications:", medsRes.error.message);
    if (vitalsRes.error) console.warn("[chat] vitals:", vitalsRes.error.message);
    if (symptomRes.error) console.warn("[chat] symptoms:", symptomRes.error.message);

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

    const personalContext = [
      "PERSONAL HEALTH CONTEXT (use only for personalization; do not expose sensitive details unnecessarily):",
      line("Member name", session.name ?? null),
      line("Member email", session.email ?? null),
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
      line("Active conditions", conditions.length ? conditions.join("; ") : null),
      line("Allergies", allergies.length ? allergies.join("; ") : null),
      line("Active medications", meds.length ? meds.join("; ") : null),
      line("Health notes", (healthRes.data?.notes as string | null) ?? null),
    ].join("\n");

    const displayName = session.name?.trim() || "Member";
    const pregStatus = (pregnancyRes.data?.pregnancy_status as string | null) ?? null;
    const pregWeek =
      pregnancyRes.data?.gestational_age_weeks != null
        ? String(pregnancyRes.data.gestational_age_weeks)
        : null;

    if (isAskMyName(lastUser.content)) {
      const reply =
        preferredReplyLanguage === "bn"
          ? `আপনার নাম ${displayName}।`
          : `Your name is ${displayName}.`;
      return NextResponse.json({
        reply,
        provider: "gemini" as const,
        needsClientLocation: false,
        citations: [],
      });
    }

    if (isAskWhatYouKnowAboutMe(lastUser.content)) {
      const statusBn =
        pregStatus === "pregnant"
          ? "আপনি এখন pregnant স্টেজে আছেন"
          : pregStatus === "planning"
            ? "আপনি এখন planning স্টেজে আছেন"
            : pregStatus === "postpartum"
              ? "আপনি এখন postpartum স্টেজে আছেন"
              : "আপনার স্টেজ তথ্য পুরোপুরি আপডেট নেই";
      const weekBn = pregWeek ? `, এবং আপনার গর্ভকাল প্রায় ${pregWeek} সপ্তাহ` : "";
      const weekEn = pregWeek ? ` and your gestational week is about ${pregWeek}` : "";
      const reply =
        preferredReplyLanguage === "bn"
          ? `আমি আপনার প্রোফাইল থেকে যা জানি: আপনার নাম ${displayName}, ${statusBn}${weekBn}।`
          : `From your profile, I know: your name is ${displayName}, your stage is ${pregStatus ?? "not fully set"}${weekEn}.`;
      return NextResponse.json({
        reply,
        provider: "gemini" as const,
        needsClientLocation: false,
        citations: [],
      });
    }

    const transcript = buildBudgetedTranscript(messages);
    const nearbyIntent = detectNearbyFacilitiesIntent(lastUser.content);
    let nearbyFacilitiesText = "";
    if (nearbyIntent) {
      if (userLocation) {
        nearbyFacilitiesText = await buildNearbyFacilitiesContextForChat(supabase, {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          intent: nearbyIntent,
        });
      } else {
        nearbyFacilitiesText = [
          "The user’s message suggests they want nearby hospitals or pharmacies, but no GPS coordinates were sent yet.",
          "Reply in ONE short, warm sentence: a popup will ask them to allow location so you can list nearby options.",
          "Do NOT tell them to send their question again or type “I shared location” — the app will automatically continue this conversation with GPS right after they allow permission.",
        ].join(" ");
      }
    }

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

    const systemInstruction = [
      "You are MaaCare, a supportive maternity and wellness assistant.",
      "Always remind users that this is informational, not medical diagnosis.",
      "Ground answers in the provided CONTEXT when it is relevant. If CONTEXT is insufficient, say so clearly.",
      "Personalize guidance using PERSONAL HEALTH CONTEXT when relevant to the user question.",
      "Address the user by first name naturally when appropriate (not every sentence).",
      "If personal context is missing for a needed decision, ask a brief clarifying question.",
      "Use clear, compassionate language. Prefer short paragraphs.",
      ...(preferredReplyLanguage === "bn"
        ? [
            "Reply in natural conversational Bangla (বাংলা), not literal translated English.",
            "Match the user's tone and phrasing style when appropriate.",
            "Keep important medical terms bilingual when useful, e.g., রক্তচাপ (blood pressure).",
          ]
        : ["Reply in clear English."]),
      "",
      personalContext,
      "",
      reportContextText ? `${reportContextText}\n` : "",
      nearbyFacilitiesText ? `${nearbyFacilitiesText}\n` : "",
      "CONTEXT (retrieved articles):",
      context,
    ].join("\n");

    const userMessage = [
      "LATEST USER TURN (original):",
      latestUserOriginal || "(empty)",
      "",
      "LATEST USER TURN (English-normalized for retrieval semantics):",
      latestUserEnglish || "(empty)",
      "",
      "Conversation so far:",
      transcript,
      "",
      "Use BOTH latest-turn versions to understand intent.",
      "Generate one final answer in the user's preferred language naturally.",
      "Do not mention translation steps.",
    ].join("\n");

    const out = await generateTextWithGeminiGroqFailover({
      systemInstruction,
      userMessage,
    });

    const needsClientLocation = Boolean(nearbyIntent && !userLocation);

    return NextResponse.json({
      reply: out.text,
      provider: out.provider,
      needsClientLocation,
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
