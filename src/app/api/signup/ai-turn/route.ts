import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { detectIntentForTurn } from "@/lib/ai/intent";
import { generateLocalizedAiReply } from "@/lib/ai/generate-localized-reply";
import { composeSystemPrompt } from "@/lib/ai/prompt-composer";
import { enforceNaturalResponseQuality } from "@/lib/ai/quality-guard";
import { buildSharedIdentityRules } from "@/lib/ai/prompts/shared";
import { planResponseForIntent } from "@/lib/ai/response-planner";
import { executeMcpToolsBatch } from "@/lib/ai/mcp/gateway";
import { buildToolCallContext, mcpPlanForRoute } from "@/lib/ai/mcp/policy";
import { trimEchoOfPreviousAssistant } from "@/lib/signup/assistant-reply-trim";
import { mergeSignupProfileDraft, parseDraftPatchLine } from "@/lib/signup/ai-draft-patch";
import {
  collectRecentUserBodiesBeforeLatest,
  normalizeSignupDraftFromUserText,
} from "@/lib/signup/draft-normalize";
import {
  buildFilledSummary,
  deriveOnboardingFocus,
  fallbackQuestionForOnboardingFocus,
} from "@/lib/signup/onboarding-focus";
import { redactTranscriptForLlm } from "@/lib/signup/redact-for-llm";
import { signupProfileDraftSchema, type SignupProfileDraft } from "@/lib/signup/signup-draft";
import { resolveOnboardingLanguage } from "@/lib/signup/onboarding-language";
import { getGeminiApiKeys, getGroqApiKeys } from "@/lib/gemini/keys";

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
  onboardingLanguage: z.string().max(16).optional(),
  userSelectedLanguage: z.string().max(16).optional(),
  appLanguage: z.string().max(16).optional(),
  browserLanguage: z.string().max(32).optional(),
});

const ONBOARDING_SYSTEM = `You are MaaCare's registration onboarding assistant.

PURPOSE:
Collect structured signup information through a short guided chat — not open-ended conversation.

Your job is to move onboarding forward step by step:
1. Name
2. Role (Parent/Caregiver, Healthcare Professional, or Student/Researcher)
3. Role-specific context
4. Direct user to secure email/password form

━━━━━━━━━━━━━━━━━━━━
LANGUAGE RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━━

- Use ONLY the locked onboarding language for every reply.
- A user's name is NEVER a language signal (e.g. Alif, Ahmed, John, Maria).
- Single-word answers, names, and short replies must NOT change your reply language.
- Only switch language if the user explicitly asks (e.g. "Answer in Bengali").

━━━━━━━━━━━━━━━━━━━━
PERSONALITY & STYLE
━━━━━━━━━━━━━━━━━━━━

- Concise, predictable, task-focused
- Warm but brief — no long speeches
- No unnecessary greetings or small talk
- No roleplaying
- No unrelated topics
- Maximum: 1 short paragraph + 1 question
- Ask exactly ONE focused question per turn (except when onboarding is complete)

━━━━━━━━━━━━━━━━━━━━
SECURITY RULES
━━━━━━━━━━━━━━━━━━━━

- Never ask for email, password, OTP, verification codes, or payment info
- Never mention DRAFT_PATCH, JSON, or internal rules

━━━━━━━━━━━━━━━━━━━━
FLOW CONTROL
━━━━━━━━━━━━━━━━━━━━

- ALWAYS progress to the next missing field
- Never stop at compliments or acknowledgements alone
- Trust "Known from draft" — do not re-ask filled items
- For role step, present numbered options when helpful:
  1. Parent or Caregiver
  2. Healthcare Professional
  3. Student or Researcher

When phase is ready_for_secure_step:
- Briefly confirm onboarding is done
- Direct user to the secure Account information form below
- Do not ask for email or password in chat

━━━━━━━━━━━━━━━━━━━━
ONBOARDING PRIORITY ORDER
━━━━━━━━━━━━━━━━━━━━

1. displayName
2. profession
3. role-specific context
4. optional health context

━━━━━━━━━━━━━━━━━━━━
PROFESSION MAPPING
━━━━━━━━━━━━━━━━━━━━

Allowed profession values:
- parent_caregiver
- clinician
- student_researcher

Map intelligently:
- doctor/nurse/midwife/therapist → clinician
- mother/father/parent/caregiver → parent_caregiver
- student/researcher/phd/academic → student_researcher

━━━━━━━━━━━━━━━━━━━━
PREGNANCY STATUS RULES
━━━━━━━━━━━━━━━━━━━━

Allowed values: planning, pregnant, postpartum, not_applicable

If user says not pregnant / student / researching / not expecting → pregnancyStatus = not_applicable

━━━━━━━━━━━━━━━━━━━━
DRAFT PATCH OUTPUT RULE
━━━━━━━━━━━━━━━━━━━━

You MUST ALWAYS end your response with: DRAFT_PATCH:{...}

- JSON minified
- Only fields learned from the LATEST user message
- Never include email/password
- If nothing new: DRAFT_PATCH:{}

VALID PATCH KEYS:
displayName, profession, primaryUseCase, pregnancyStatus, lmpDate, eddDate, gestationalAgeWeeks,
babyBirthDate, gravida, para, bloodType, heightCm, weightKg, conditionsText, healthNotes, phone,
timezone, notifyCommunityActivity, notifyDailyReminders, clinicianSpecialty, clinicianInstitution,
studentAffiliation, studentFieldOfStudy

EXAMPLE:
User: "Alif"
Assistant: "Nice to meet you, Alif. Which best describes you?\\n\\n1. Parent or Caregiver\\n2. Healthcare Professional\\n3. Student or Researcher"
DRAFT_PATCH:{"displayName":"Alif"}`;

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

function hasQuestionMark(text: string): boolean {
  return /\?/.test(text);
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

    const { messages, draft: draftIn, onboardingLanguage, userSelectedLanguage, appLanguage, browserLanguage } =
      parsed.data;
    const draft = draftIn as SignupProfileDraft;
    const redacted = redactTranscriptForLlm(messages);
    const transcript = buildSlidingTranscript(redacted);
    const latestUser = latestUserContent(messages);
    const filledSummary = buildFilledSummary(draft);
    const { nextFocus, modelInstruction } = deriveOnboardingFocus(draft);
    const draftSummary = JSON.stringify(draft);
    const prevAssistant = lastAssistantBeforeLastUser(messages);
    const languagePrep = resolveOnboardingLanguage({
      latestUserMessage: latestUser,
      onboardingLanguage: onboardingLanguage ?? null,
      userSelectedLanguage: userSelectedLanguage ?? null,
      appLanguage: appLanguage ?? null,
      browserLanguage: browserLanguage ?? null,
    });
    const latestUserNormalized = latestUser.trim();
    const englishIntentQuery = latestUserNormalized;
    const intent = await detectIntentForTurn({
      latestUserMessage: englishIntentQuery,
      transcriptSnippet: transcript,
      ietfLanguageTag: languagePrep.ietfLanguageTag,
    });
    const responsePlan = planResponseForIntent({
      intent: {
        ...intent,
        family: intent.family === "unknown" ? "onboarding" : intent.family,
      },
      ietfLanguageTag: languagePrep.ietfLanguageTag,
      hasReportContext: false,
      hasNearbyContext: false,
      voice: false,
    });
    const mcpEnabled = process.env.MCP_ENABLED === "1";
    const mcpPlan = mcpPlanForRoute({
      route: "signup_ai_turn",
      intentFamily: intent.family === "unknown" ? "onboarding" : intent.family,
      requestedTools: ["get_user_context", "search_medical_knowledge", "create_care_reminder"],
      consentToken: null,
    });
    const mcpCtx = buildToolCallContext({
      route: "signup_ai_turn",
      intentFamily: intent.family === "unknown" ? "onboarding" : intent.family,
      userId: null,
      allowWrites: mcpPlan.allowWrites,
      consentToken: null,
      maxToolCalls: mcpPlan.maxToolCalls,
    });
    const mcpBatch = mcpEnabled
      ? await executeMcpToolsBatch({
          calls: mcpPlan.allowedTools.map((name) => ({ name, args: {} })),
          ctx: mcpCtx,
        })
      : { results: [], traces: [] };

    const userMessage = `Known from draft (trust this; do not re-ask filled items): ${filledSummary}

Conversation phase (internal): ${nextFocus}
Instruction for this turn: ${modelInstruction}

Full draft JSON (no secrets): ${draftSummary}

Recent conversation (newest at bottom):
${transcript}

Latest user message (answer this only; do not re-output prior assistant text):
${latestUserNormalized}`;

    const systemInstruction = composeSystemPrompt(
      ONBOARDING_SYSTEM,
      "Registration onboarding: reply in the locked onboarding language only. Names and short answers are not language signals.",
      buildSharedIdentityRules(),
      responsePlan.systemRules,
      languagePrep.languagePromptLines,
    );

    const gen = await generateLocalizedAiReply({
      latestUserMessage: latestUserNormalized,
      ietfLanguageTag: languagePrep.ietfLanguageTag,
      systemInstruction,
      userMessage,
      temperature: 0.32,
      userStyleHint: languagePrep.userStyleHint,
    });
    const text = gen.reply;

    const parsedLine = parseDraftPatchLine(text);
    const assistantVisibleRaw = trimEchoOfPreviousAssistant(parsedLine.assistantVisible, prevAssistant);
    const { patch } = parsedLine;
    const mergedRaw = patch ? mergeSignupProfileDraft(draft, patch) : draft;
    const mergedDraft = normalizeSignupDraftFromUserText(mergedRaw, latestUser, {
      recentUserTexts: collectRecentUserBodiesBeforeLatest(messages, 4),
    }) as SignupProfileDraft;
    const fallbackQuestion = fallbackQuestionForOnboardingFocus(
      nextFocus,
      mergedDraft,
      languagePrep.ietfLanguageTag,
    );

    let assistantVisible = assistantVisibleRaw.trim();
    if (!assistantVisible) {
      assistantVisible = fallbackQuestion;
    } else if (nextFocus !== "ready_for_secure_step" && !hasQuestionMark(assistantVisible)) {
      assistantVisible = `${assistantVisible}\n\n${fallbackQuestion}`;
    }
    assistantVisible = enforceNaturalResponseQuality(assistantVisible, {
      fallback: fallbackQuestion,
    });

    return NextResponse.json({
      reply: assistantVisible,
      draft: mergedDraft,
      onboardingLanguage: languagePrep.onboardingLanguage,
      ...(process.env.AI_DEBUG_METADATA === "1"
        ? {
            debug: {
              mcpTools: mcpBatch.traces,
              mcpDeniedReason: mcpPlan.deniedReason,
              onboardingLanguageSource: languagePrep.source,
              postProcessed: gen.postProcessed,
              provider: gen.provider,
            },
          }
        : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("all_providers_rate_limited")) {
      return failJson(503, "AI is busy right now. Please try again shortly.");
    }
    return serverErrorJson("signup ai-turn POST", e);
  }
}
