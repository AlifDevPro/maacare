import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import { getSessionFromCookies } from "@/lib/auth/get-session";
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
});

const MAX_TRANSCRIPT_TOKENS = 2600;
const MAX_MESSAGE_CHARS_IN_TRANSCRIPT = 1200;

function line(label: string, value: string | null | undefined): string {
  return `${label}: ${value && value.trim() ? value.trim() : "n/a"}`;
}

function estimateTokens(text: string): number {
  // Practical heuristic for LLM budgeting.
  return Math.ceil(text.length / 4);
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

function isRateLimitError(raw: string): boolean {
  const msg = raw.toLowerCase();
  return (
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("429")
  );
}

function geminiKeys(): string[] {
  const joined = process.env.GEMINI_API_KEYS?.trim();
  if (joined) {
    return joined
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  const single = process.env.GEMINI_API_KEY?.trim();
  return single ? [single] : [];
}

function groqKeys(): string[] {
  const joined = process.env.GROQ_API_KEYS?.trim();
  if (joined) {
    return joined
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  const single = process.env.GROQ_API_KEY?.trim();
  return single ? [single] : [];
}

async function generateWithGemini(
  apiKey: string,
  systemInstruction: string,
  userMessage: string,
): Promise<string> {
  const modelName = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
  });
  const result = await model.generateContent(userMessage);
  return result.response.text().trim();
}

async function generateWithGroq(
  apiKey: string,
  systemInstruction: string,
  userMessage: string,
): Promise<string> {
  const model = process.env.GROQ_CHAT_MODEL?.trim() || "llama-3.1-8b-instant";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!res.ok) {
    throw new Error(payload.error?.message ?? `groq_http_${res.status}`);
  }
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("groq_empty_response");
  return text;
}

async function generateWithFailover(input: {
  systemInstruction: string;
  userMessage: string;
}): Promise<{ reply: string; provider: "gemini" | "groq" }> {
  const errors: string[] = [];

  for (const key of geminiKeys()) {
    try {
      const reply = await generateWithGemini(key, input.systemInstruction, input.userMessage);
      if (reply) return { reply, provider: "gemini" };
      errors.push("gemini: empty response");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      errors.push(`gemini: ${m}`);
      if (!isRateLimitError(m)) break;
    }
  }

  for (const key of groqKeys()) {
    try {
      const reply = await generateWithGroq(key, input.systemInstruction, input.userMessage);
      if (reply) return { reply, provider: "groq" };
      errors.push("groq: empty response");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      errors.push(`groq: ${m}`);
      if (!isRateLimitError(m)) break;
    }
  }

  if (errors.length > 0 && errors.every((e) => isRateLimitError(e))) {
    throw new Error("all_providers_rate_limited");
  }
  throw new Error(`all_providers_failed: ${errors.join(" | ")}`);
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, reportContext } = bodySchema.parse(await req.json());
    const supabase = await createSupabaseServerClient();

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json({ error: "No user message" }, { status: 400 });
    }

    const hits = await searchKnowledge(lastUser.content, {
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

    const transcript = buildBudgetedTranscript(messages);
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
      "Use clear, compassionate language. Prefer short paragraphs. format in a para so user understand bette",
      "",
      personalContext,
      "",
      reportContextText ? `${reportContextText}\n` : "",
      "CONTEXT (retrieved articles):",
      context,
    ].join("\n");

    const userMessage = [
      "Conversation so far:",
      transcript,
      "",
      "Reply to the latest user turn helpfully.",
    ].join("\n");

    const out = await generateWithFailover({
      systemInstruction,
      userMessage,
    });

    return NextResponse.json({
      reply: out.reply,
      provider: out.provider,
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
