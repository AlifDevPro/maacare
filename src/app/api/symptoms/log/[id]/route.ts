import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { generateChatReply } from "@/lib/gemini/chat";
import { searchKnowledge } from "@/lib/rag/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

function riskLevelFromSeverity(severity: number | null): "low" | "medium" | "high" {
  if (!severity) return "low";
  if (severity >= 7) return "high";
  if (severity >= 4) return "medium";
  return "low";
}

function buildInsight(input: {
  symptomCodes: string[];
  severity: number | null;
  title: string | null;
}): string {
  const level = riskLevelFromSeverity(input.severity);
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
  return `${symptomPart} ${sevPart} ${advice}`;
}

async function fetchRiskRulesContext(input: {
  symptomCodes: string[];
  severity: number | null;
  title: string | null;
}): Promise<string | null> {
  const query = [
    "Pregnancy symptom risk rules and triage guidance.",
    input.title ? `Title: ${input.title}.` : "",
    input.symptomCodes.length > 0 ? `Symptoms: ${input.symptomCodes.join(", ")}.` : "",
    input.severity != null ? `Severity: ${input.severity}/10.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const hits = await searchKnowledge(query, {
    limit: 5,
    categories: ["risk-rules"],
  });
  if (hits.length === 0) return null;
  return hits
    .map((h, i) => `[${i + 1}] (${h.source ?? "risk-rules"})\n${h.content}`)
    .join("\n\n---\n\n");
}

function buildUserMessageForRag(input: {
  symptomCodes: string[];
  severity: number | null;
  title: string | null;
}): string {
  return [
    `Symptoms: ${input.symptomCodes.join(", ") || "not specified"}`,
    `Title: ${input.title ?? "n/a"}`,
    `Severity: ${input.severity != null ? `${input.severity}/10` : "n/a"}`,
    "",
    "Provide supportive assessment and next-step guidance.",
  ].join("\n");
}

async function buildRagRiskInsightFromContext(
  context: string,
  input: {
    symptomCodes: string[];
    severity: number | null;
    title: string | null;
  },
): Promise<string | null> {
  const systemInstruction = [
    "You are a conservative maternal symptom triage assistant.",
    "Use only the provided RISK-RULES context.",
    "Give plain-language guidance in 3-5 sentences.",
    "Do not diagnose. If severe/red-flag risk appears, clearly advise urgent care.",
    "",
    "RISK-RULES CONTEXT:",
    context,
  ].join("\n");

  const reply = await generateChatReply({
    systemInstruction,
    userMessage: buildUserMessageForRag(input),
  });
  return reply.trim() || null;
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

async function buildRagSuggestionsFromContext(
  context: string,
  input: {
    symptomCodes: string[];
    severity: number | null;
    title: string | null;
  },
): Promise<string[]> {
  const systemInstruction = [
    "You are a conservative maternal symptom triage assistant.",
    "Use only the provided RISK-RULES context.",
    "Return ONLY a JSON array of 3 to 5 strings: short, practical next-step suggestions tailored to this log.",
    "No diagnoses. Prefer hydration, rest, monitoring, and when to escalate to a clinician.",
    "Example: [\"Drink water and rest 20 minutes\",\"Track contractions for 1 hour\",\"Call your provider if pain worsens\"]",
    "",
    "RISK-RULES CONTEXT:",
    context,
  ].join("\n");

  const reply = await generateChatReply({
    systemInstruction,
    userMessage: buildUserMessageForRag(input),
  });
  const block = extractJsonArray(reply.trim());
  if (!block) return [];
  try {
    const parsed = JSON.parse(block) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const parsedId = uuid.safeParse((await context.params).id);
    if (!parsedId.success) return failJson(400, "Invalid symptom log id.");

    const supabase = await createSupabaseServerClient();
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
    let insight = buildInsight({ symptomCodes, severity, title });
    let suggestions: string[] = [];
    try {
      const ctx = await fetchRiskRulesContext({ symptomCodes, severity, title });
      if (ctx) {
        const [ragInsight, ragSuggestions] = await Promise.all([
          buildRagRiskInsightFromContext(ctx, { symptomCodes, severity, title }),
          buildRagSuggestionsFromContext(ctx, { symptomCodes, severity, title }),
        ]);
        if (ragInsight) insight = ragInsight;
        suggestions = ragSuggestions;
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
    });
  } catch (e) {
    return serverErrorJson("symptoms_log_id GET", e);
  }
}

