import { z } from "zod";

import { generateTextWithGeminiGroqFailover } from "@/lib/gemini/text-failover";

export const intentFamilyValues = [
  "identity",
  "greeting",
  "symptom_guidance",
  "planning",
  "nearby_facilities",
  "report_explanation",
  "onboarding",
  "smalltalk",
  "offtopic",
  "general_health",
  "unknown",
] as const;

export type IntentFamily = (typeof intentFamilyValues)[number];

export const responseModeValues = [
  "answer_with_context",
  "answer_without_context",
  "ask_clarification",
  "brief_redirect",
] as const;

export type ResponseMode = (typeof responseModeValues)[number];

const intentSchema = z.object({
  family: z.enum(intentFamilyValues),
  goal: z.string().trim().min(1).max(240),
  responseMode: z.enum(responseModeValues),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
});

export type IntentResult = z.infer<typeof intentSchema>;

function normalizeLoose(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUltraShortAmbiguous(text: string): boolean {
  const n = normalizeLoose(text);
  if (!n) return true;
  const words = n.split(" ").filter(Boolean);
  if (n.length <= 3) return true;
  if (words.length <= 2 && n.length <= 8) return true;
  return false;
}

function isIdentityLikeAsk(text: string): boolean {
  const n = normalizeLoose(text);
  return (
    /who are you|what s your name|what is your name/.test(n) ||
    /tor nam ki|tomar nam ki|tumi ke|apni ke|আপনি কে|তুমি কে|তোমার নাম|আপনার নাম/.test(n) ||
    /amar nam ki|ami ke|আমার নাম কি|আমি কে/.test(n)
  );
}

function normalizeJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const body = fenced ? fenced[1]!.trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return body.slice(start, end + 1);
}

function heuristicIntent(latestUserMessage: string): IntentResult {
  const t = latestUserMessage.trim().toLowerCase();
  const n = normalizeLoose(t);
  const isGreeting = /^(hi|hello|hey|assalamu|salam|আসসালামু|হাই)\b/.test(t);
  const asksWho =
    /who are you|what(?:'s| is) your name|তোমার নাম|তুই কে|tor nam|tomar nam|tumi ke|আপনি কে|তুমি কে/.test(
      t,
    ) || isIdentityLikeAsk(t);
  const asksNearby = /nearby|nearest|hospital|clinic|pharmacy|নিকট|কাছে|হাসপাতাল|ফার্মেসি/.test(t);
  const asksReport = /report|lab|cbc|hemoglobin|analysis|রিপোর্ট|রক্ত/.test(t);
  const asksSymptom = /pain|bleeding|fever|nausea|cramp|symptom|উপসর্গ|ব্যথা|জ্বর/.test(t);
  const asksPlan =
    /plan|diet|meal|food|routine|কী খাব|খাবার|প্ল্যান|appointment|book(?:ing)?|schedule|checkup|visit|ডাক্তার|অ্যাপয়েন্টমেন্ট/.test(
      t,
    );

  if (asksWho) {
    return {
      family: "identity",
      goal: "User asks assistant identity",
      responseMode: "answer_without_context",
      confidence: 0.88,
      needsClarification: false,
    };
  }
  if (isGreeting) {
    return {
      family: "greeting",
      goal: "User greeting",
      responseMode: "answer_without_context",
      confidence: 0.8,
      needsClarification: false,
    };
  }
  if (asksNearby) {
    return {
      family: "nearby_facilities",
      goal: "User wants nearby care facilities",
      responseMode: "answer_with_context",
      confidence: 0.74,
      needsClarification: false,
    };
  }
  if (asksReport) {
    return {
      family: "report_explanation",
      goal: "User asks report explanation",
      responseMode: "answer_with_context",
      confidence: 0.72,
      needsClarification: false,
    };
  }
  if (asksSymptom) {
    return {
      family: "symptom_guidance",
      goal: "User asks symptom guidance",
      responseMode: "answer_with_context",
      confidence: 0.72,
      needsClarification: false,
    };
  }
  if (asksPlan) {
    return {
      family: "planning",
      goal: "User asks planning support",
      responseMode: "answer_with_context",
      confidence: 0.7,
      needsClarification: false,
    };
  }
  if (isUltraShortAmbiguous(t) && !asksWho) {
    return {
      family: "unknown",
      goal: "Message too short to infer safely",
      responseMode: "ask_clarification",
      confidence: 0.28,
      needsClarification: true,
    };
  }
  if (/(ami k|ami ke|আমি কে|amar nam|আমার নাম)/.test(n) && !asksWho) {
    return {
      family: "unknown",
      goal: "Likely self-identity query but ambiguous target",
      responseMode: "ask_clarification",
      confidence: 0.4,
      needsClarification: true,
    };
  }
  return {
    family: "general_health",
    goal: "General maternal or wellness guidance",
    responseMode: "answer_with_context",
    confidence: 0.6,
    needsClarification: false,
  };
}

export async function detectIntentForTurn(input: {
  latestUserMessage: string;
  transcriptSnippet?: string | null;
  ietfLanguageTag?: string;
}): Promise<IntentResult> {
  const latest = input.latestUserMessage.trim();
  if (!latest) return heuristicIntent(latest);
  const transcript = (input.transcriptSnippet ?? "").trim().slice(0, 1200);
  const tag = input.ietfLanguageTag?.trim().toLowerCase() || "en";

  const systemInstruction = [
    "You are an intent classifier for MaaCare assistant requests.",
    "Return strict JSON only with fields:",
    'family: one of "identity","greeting","symptom_guidance","planning","nearby_facilities","report_explanation","onboarding","smalltalk","offtopic","general_health","unknown"',
    'goal: concise English phrase of user goal',
    'responseMode: one of "answer_with_context","answer_without_context","ask_clarification","brief_redirect"',
    "confidence: number between 0 and 1",
    "needsClarification: boolean",
    "Decide from latest user message first; use transcript only for disambiguation.",
    'If user asks about assistant identity/name (e.g., "tomar nam ki", "who are you"), choose family="identity".',
    'If user asks about their own identity/name (e.g., "amar nam ki", "who am I"), prefer family="identity" when clear; otherwise unknown + ask_clarification.',
    "Prefer unknown + ask_clarification when intent is too ambiguous.",
  ].join("\n");

  const userMessage = [
    `Resolved language tag: ${tag}`,
    "LATEST_USER_MESSAGE:",
    latest,
    transcript ? `\nTRANSCRIPT_SNIPPET:\n${transcript}` : "",
  ].join("\n");

  try {
    const out = await generateTextWithGeminiGroqFailover({
      systemInstruction,
      userMessage,
      temperature: 0.1,
    });
    const rawJson = normalizeJsonObject(out.text);
    if (!rawJson) return heuristicIntent(latest);
    const parsed = intentSchema.safeParse(JSON.parse(rawJson));
    if (!parsed.success) return heuristicIntent(latest);
    return parsed.data;
  } catch {
    return heuristicIntent(latest);
  }
}
