import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { trimEchoOfPreviousAssistant } from "@/lib/signup/assistant-reply-trim";
import { mergeSignupProfileDraft, parseDraftPatchLine } from "@/lib/signup/ai-draft-patch";
import {
  collectRecentUserBodiesBeforeLatest,
  normalizeSignupDraftFromUserText,
} from "@/lib/signup/draft-normalize";
import { buildFilledSummary, deriveOnboardingFocus } from "@/lib/signup/onboarding-focus";
import { redactTranscriptForLlm } from "@/lib/signup/redact-for-llm";
import { signupProfileDraftSchema, type SignupProfileDraft } from "@/lib/signup/signup-draft";
import { getGeminiApiKeys, getGroqApiKeys } from "@/lib/gemini/keys";
import { generateTextWithGeminiGroqFailover } from "@/lib/gemini/text-failover";

const MAX_MESSAGES = 26;
const MAX_MESSAGE_CHARS = 2800;
const TRANSCRIPT_TAIL_TURNS = 8;
const MAX_PER_IP_PER_MIN = Math.min(
  80,
  Math.max(10, Number.parseInt(process.env.SIGNUP_AI_MAX_PER_IP_PER_MIN ?? "36", 10) || 36),
);

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(MAX_MESSAGE_CHARS),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGES),
  draft: signupProfileDraftSchema,
});

const ONBOARDING_SYSTEM = `You are MaaCare's friendly signup assistant helping someone create an account through chat.

Hard rules:
- Never ask for email, password, or OTPs. Those go on the secure screen after chat.
- Never ask for a field that is already filled according to the "Known from draft" line you receive each turn.
- Write ONLY your new reply for this turn. Do not repeat, quote, summarize, or paste earlier assistant messages from the transcript.
- At most one clear question per turn unless the user explicitly asked several things.
- One or two short paragraphs max; warm and plain-language. Short bullet list only if it genuinely helps.
- End your reply with a single final line: DRAFT_PATCH: then minified JSON with only keys you learned from the LATEST user message (omit unknown keys). Allowed keys: displayName, profession (parent_caregiver|clinician|other), pregnancyStatus (planning|pregnant|postpartum|not_applicable), lmpDate, eddDate, gestationalAgeWeeks (string or number), babyBirthDate, gravida, para, bloodType (A+|A-|...|unknown), heightCm, weightKg, conditionsText, healthNotes, phone, timezone, notifyCommunityActivity, notifyDailyReminders (booleans).
- If nothing new was learned, use DRAFT_PATCH:{}
- Never put email or password into DRAFT_PATCH or conversational text.
- If the user says they are not pregnant, not expecting, a student/researcher with no pregnancy journey, or similar, you MUST set pregnancyStatus to not_applicable (unless they also clearly say they are currently pregnant). Map student/researcher/academic roles to profession "other" unless they clearly say they are a clinician or a parent/caregiver using the app for family.
- Extra nuance (e.g. "PhD student") may also go in healthNotes as a short phrase in addition to profession when using "other".
- Even in the final phase (name and role already saved), you MUST still output DRAFT_PATCH corrections if the user clarifies pregnancy status or role in the latest message.`;

type Msg = { role: "user" | "assistant"; content: string };

function lastAssistantBeforeLastUser(messages: Msg[]): string | undefined {
  const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
  if (lastUserIdx <= 0) return undefined;
  for (let i = lastUserIdx - 1; i >= 0; i--) {
    if (messages[i]!.role === "assistant") return messages[i]!.content;
  }
  return undefined;
}

function latestUserContent(messages: Msg[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  return last?.content?.trim() ?? "";
}

/** Last N turns for the model; optional one-line digest when older messages exist. */
function buildSlidingTranscript(redacted: Msg[]): string {
  const dropped = Math.max(0, redacted.length - TRANSCRIPT_TAIL_TURNS);
  const tail = redacted.slice(-TRANSCRIPT_TAIL_TURNS);
  const body = tail
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  if (dropped === 0) return body;

  const firstUser = redacted.find((m) => m.role === "user");
  const hint = firstUser?.content.trim().slice(0, 140) ?? "";
  return `[Earlier: ${dropped} older message(s) omitted. First user line: ${hint || "n/a"}]\n\n${body}`;
}

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const xf = h.get("x-forwarded-for");
    if (xf) return xf.split(",")[0]!.trim() || "unknown";
    return h.get("x-real-ip")?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function bumpRateLimit(ip: string): boolean {
  type G = typeof globalThis & { __signupAiTurns?: Map<string, number> };
  const g = globalThis as G;
  if (!g.__signupAiTurns) g.__signupAiTurns = new Map();
  const bucket = Math.floor(Date.now() / 60_000);
  const key = `${ip}:${bucket}`;
  const n = (g.__signupAiTurns.get(key) ?? 0) + 1;
  g.__signupAiTurns.set(key, n);
  if (g.__signupAiTurns.size > 5000) {
    const cutoff = bucket - 5;
    for (const k of g.__signupAiTurns.keys()) {
      const b = Number(k.split(":").pop());
      if (Number.isFinite(b) && b < cutoff) g.__signupAiTurns.delete(k);
    }
  }
  return n <= MAX_PER_IP_PER_MIN;
}

export async function POST(req: Request) {
  try {
    if (!bumpRateLimit(await clientIp())) {
      return failJson(429, "Too many signup chat requests. Please wait a minute and try again.");
    }

    if (getGeminiApiKeys().length === 0 && getGroqApiKeys().length === 0) {
      return failJson(503, "AI signup is temporarily unavailable.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const { messages, draft: draftIn } = parsed.data;
    const draft = draftIn as SignupProfileDraft;
    const redacted = redactTranscriptForLlm(messages);
    const transcript = buildSlidingTranscript(redacted);
    const latestUser = latestUserContent(messages);
    const filledSummary = buildFilledSummary(draft);
    const { nextFocus, modelInstruction } = deriveOnboardingFocus(draft);
    const draftSummary = JSON.stringify(draft);
    const prevAssistant = lastAssistantBeforeLastUser(messages);

    const userMessage = `Known from draft (trust this; do not re-ask filled items): ${filledSummary}

Conversation phase (internal): ${nextFocus}
Instruction for this turn: ${modelInstruction}

Full draft JSON (no secrets): ${draftSummary}

Recent conversation (newest at bottom):
${transcript}

Latest user message (answer this only; do not re-output prior assistant text):
${latestUser}`;

    const { text } = await generateTextWithGeminiGroqFailover({
      systemInstruction: ONBOARDING_SYSTEM,
      userMessage,
      temperature: 0.5,
    });

    const parsedLine = parseDraftPatchLine(text);
    const assistantVisible = trimEchoOfPreviousAssistant(parsedLine.assistantVisible, prevAssistant);
    const { patch } = parsedLine;
    const mergedRaw = patch ? mergeSignupProfileDraft(draft, patch) : draft;
    const mergedDraft = normalizeSignupDraftFromUserText(mergedRaw, latestUser, {
      recentUserTexts: collectRecentUserBodiesBeforeLatest(messages, 4),
    }) as SignupProfileDraft;

    return NextResponse.json({
      reply: assistantVisible,
      draft: mergedDraft,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("all_providers_rate_limited")) {
      return failJson(503, "AI is busy right now. Please try again shortly.");
    }
    return serverErrorJson("signup ai-turn POST", e);
  }
}
