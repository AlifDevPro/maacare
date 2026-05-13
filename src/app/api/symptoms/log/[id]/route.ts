import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { generateChatReply } from "@/lib/gemini/chat";
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

function buildInsight(input: SymptomLogInsightInput): string {
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
  const desc = truncateForDisplay(input.description, DESC_TRUNC_HEURISTIC);
  const notePart = desc ? ` You also noted: ${desc}` : "";
  return `${symptomPart} ${sevPart} ${advice}${notePart}`;
}

async function fetchRiskRulesContext(input: SymptomLogInsightInput): Promise<string | null> {
  const descQ = truncateForDisplay(input.description, DESC_TRUNC_RAG);
  const query = [
    "Pregnancy symptom risk rules and triage guidance.",
    input.title ? `Title: ${input.title}.` : "",
    input.symptomCodes.length > 0 ? `Symptoms: ${input.symptomCodes.join(", ")}.` : "",
    input.severity != null ? `Severity: ${input.severity}/10.` : "",
    descQ ? `User additional notes: ${descQ}.` : "",
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
): Promise<string | null> {
  const hasFreeText = Boolean(input.description?.trim());
  const systemInstruction = [
    "You are a conservative maternal symptom triage assistant.",
    "Use only the provided RISK-RULES context.",
    "Give plain-language guidance in 3-5 sentences.",
    "Do not diagnose. If severe/red-flag risk appears, clearly advise urgent care.",
    hasFreeText
      ? "When the user message includes Additional notes, reflect those details together with the listed symptoms. For concerns not clearly covered by the context, advise the user to discuss them with their clinician without inventing specifics."
      : "",
    "",
    "RISK-RULES CONTEXT:",
    context,
  ]
    .filter(Boolean)
    .join("\n");

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
  input: SymptomLogInsightInput,
): Promise<string[]> {
  const hasFreeText = Boolean(input.description?.trim());
  const systemInstruction = [
    "You are a conservative maternal symptom triage assistant.",
    "Use only the provided RISK-RULES context.",
    "Return ONLY a JSON array of 3 to 5 strings: short, practical next-step suggestions tailored to this log.",
    "No diagnoses. Prefer hydration, rest, monitoring, and when to escalate to a clinician.",
    hasFreeText
      ? "If the user message includes Additional notes, include at least one suggestion that addresses those notes when relevant."
      : "",
    "Example: [\"Drink water and rest 20 minutes\",\"Track contractions for 1 hour\",\"Call your provider if pain worsens\"]",
    "",
    "RISK-RULES CONTEXT:",
    context,
  ]
    .filter(Boolean)
    .join("\n");

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
    const description = (data.description as string | null) ?? null;
    const insightInput: SymptomLogInsightInput = {
      symptomCodes,
      severity,
      title,
      description,
    };
    let insight = buildInsight(insightInput);
    let suggestions: string[] = [];
    try {
      const ctx = await fetchRiskRulesContext(insightInput);
      if (ctx) {
        const [ragInsight, ragSuggestions] = await Promise.all([
          buildRagRiskInsightFromContext(ctx, insightInput),
          buildRagSuggestionsFromContext(ctx, insightInput),
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

