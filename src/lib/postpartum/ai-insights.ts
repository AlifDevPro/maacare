import { z } from "zod";

import { buildLanguagePromptLines } from "@/lib/ai/language";
import { composeSystemPrompt } from "@/lib/ai/prompt-composer";
import { enforceNaturalResponseQuality, sanitizeStructuredTextFields } from "@/lib/ai/quality-guard";
import { buildMedicalSafetyRules, buildNaturalStyleRules, buildSharedIdentityRules } from "@/lib/ai/prompts/shared";
import { planResponseForIntent } from "@/lib/ai/response-planner";
import { executeMcpTool } from "@/lib/ai/mcp/gateway";
import { buildToolCallContext, mcpPlanForRoute } from "@/lib/ai/mcp/policy";
import { generateChatReply } from "@/lib/gemini/chat";
import { searchKnowledge } from "@/lib/rag/service";

export type PostpartumInsightsPayload = {
  recovery: string;
  feeding: string;
  moodSupport: string;
  whenToSeekCare: string;
  source: "ai" | "fallback";
};

const insightSchema = z.object({
  recovery: z.string(),
  feeding: z.string(),
  moodSupport: z.string(),
  whenToSeekCare: z.string(),
});

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

export function staticPostpartumFallback(input: {
  postpartumWeek: number | null;
  moodKey: string | null;
}): Omit<PostpartumInsightsPayload, "source"> {
  const w = input.postpartumWeek;
  const mood = input.moodKey;
  let recovery =
    "Rest when you can, stay hydrated, and accept practical help. Healing is gradual — be patient with your body.";
  if (w != null && w <= 2) {
    recovery =
      "Early weeks: prioritize rest, fluids, and gentle movement. Bleeding should trend lighter — contact your clinician if it worsens.";
  } else if (w != null && w <= 6) {
    recovery =
      "Most physical healing happens in the first six weeks. Pace outings and keep follow-up appointments.";
  } else if (w != null && w <= 12) {
    recovery =
      "Energy often returns slowly — still protect sleep when possible and stay in touch with your care team.";
  }

  const feeding =
    "Whether chest/breastfeeding or formula, focus on frequent feeds early on, comfortable positioning, and hydration. Your pediatrician can adjust volumes as needed.";

  let moodSupport =
    "Baby blues are common. If low mood, anxiety, or feeling disconnected lasts more than two weeks, tell a clinician — support helps.";
  if (mood === "stressed" || mood === "overwhelmed") {
    moodSupport =
      "It is okay to feel stretched thin. Try one small reset (shower, snack, 10 minutes outside) and reach out to someone you trust or your care team.";
  } else if (mood === "tired") {
    moodSupport =
      "Sleep debt stacks quickly. Even short naps help — trade off nights with a partner or support person when possible.";
  }

  const whenToSeekCare =
    "Seek urgent care for heavy bleeding (soaking a pad in an hour), fever 38 °C (100.4 °F) or higher, severe headache with vision changes, chest pain or breathlessness, or thoughts of hurting yourself or the baby.";

  return { recovery, feeding, moodSupport, whenToSeekCare };
}

const insightCache = new Map<string, { expires: number; value: PostpartumInsightsPayload }>();
const CACHE_MS = 12 * 60 * 60 * 1000;

export function bustPostpartumInsightCacheForUser(userId: string) {
  for (const k of insightCache.keys()) {
    if (k.startsWith(`${userId}|`)) insightCache.delete(k);
  }
}

function cacheKey(parts: string[]) {
  return parts.join("|");
}

async function generatePostpartumAiJson(input: {
  ragContext: string;
  postpartumWeek: number | null;
  moodKey: string | null;
  language: string;
  pregnancyStatus: string | null;
}): Promise<Omit<PostpartumInsightsPayload, "source">> {
  const responsePlan = planResponseForIntent({
    intent: {
      family: "planning",
      goal: "Provide postpartum recovery guidance",
      responseMode: "answer_with_context",
      confidence: 0.93,
      needsClarification: false,
    },
    ietfLanguageTag: input.language,
    hasReportContext: false,
    hasNearbyContext: false,
  });
  const systemInstruction = composeSystemPrompt(
    buildSharedIdentityRules(),
    buildMedicalSafetyRules(),
    buildNaturalStyleRules(),
    responsePlan.systemRules,
    "You are a supportive maternal health educator for postpartum recovery.",
    input.ragContext
      ? "Use the CONTEXT excerpts as grounding when relevant; do not invent citations beyond them."
      : "No document context was retrieved; give cautious, evidence-informed general guidance only.",
    "Return ONLY a single JSON object with keys recovery, feeding, moodSupport, whenToSeekCare.",
    "Each value must be a string of 2-4 sentences in plain language for the user.",
    "No diagnoses or prescriptions. Encourage contacting a clinician for medical concerns.",
    buildLanguagePromptLines({ ietfLanguageTag: input.language }),
    "",
    "CONTEXT:",
    input.ragContext || "(none)",
  );

  const userMessage = [
    "Write naturally in the configured user language.",
    `Pregnancy journey status from profile: ${input.pregnancyStatus ?? "unknown"}.`,
    `Postpartum week after birth (or unknown): ${input.postpartumWeek ?? "unknown"}.`,
    `Latest mood check-in key (or none): ${input.moodKey ?? "none"}.`,
  ].join("\n");

  const raw = await generateChatReply({ systemInstruction, userMessage });
  const block = extractJsonObject(raw.trim());
  if (!block) throw new Error("No JSON object in model output");
  const parsed = insightSchema.safeParse(JSON.parse(block));
  if (!parsed.success) throw new Error("Invalid insight JSON");
  const normalized = sanitizeStructuredTextFields(parsed.data, [
    "recovery",
    "feeding",
    "moodSupport",
    "whenToSeekCare",
  ]);
  return {
    ...normalized,
    recovery: enforceNaturalResponseQuality(normalized.recovery),
    feeding: enforceNaturalResponseQuality(normalized.feeding),
    moodSupport: enforceNaturalResponseQuality(normalized.moodSupport),
    whenToSeekCare: enforceNaturalResponseQuality(normalized.whenToSeekCare),
  };
}

export async function getPostpartumInsightsCached(input: {
  userId: string;
  utcDate: string;
  postpartumWeek: number | null;
  moodKey: string | null;
  language: string;
  pregnancyStatus: string | null;
}): Promise<PostpartumInsightsPayload> {
  const key = cacheKey([
    input.userId,
    input.utcDate,
    String(input.postpartumWeek ?? "na"),
    input.moodKey ?? "",
    input.language,
    input.pregnancyStatus ?? "",
  ]);

  const now = Date.now();
  const hit = insightCache.get(key);
  if (hit && hit.expires > now) {
    return hit.value;
  }

  let ragContext = "";
  const mcpEnabled = process.env.MCP_ENABLED === "1";
  try {
    const hits = await searchKnowledge(
      [
        "Postpartum recovery newborn feeding sleep mood support red flags maternal",
        input.postpartumWeek != null ? `Postpartum week ${input.postpartumWeek}.` : "",
        input.moodKey ? `Parent mood theme: ${input.moodKey}.` : "",
      ].join(" "),
      { limit: 6, categories: ["postpartum", "education"] },
    );
    ragContext =
      hits.length > 0
        ? hits.map((h, i) => `[${i + 1}] (${h.source ?? "knowledge"})\n${h.content}`).join("\n\n---\n\n")
        : "";
  } catch (e) {
    console.warn("[postpartum insights] RAG:", e);
  }
  if (mcpEnabled) {
    try {
      const mcpPlan = mcpPlanForRoute({
        route: "postpartum_insights",
        intentFamily: "planning",
        requestedTools: ["search_medical_knowledge", "get_user_context"],
        consentToken: null,
      });
      if (mcpPlan.allowedTools.includes("search_medical_knowledge")) {
        const mcpCtx = buildToolCallContext({
          route: "postpartum_insights",
          intentFamily: "planning",
          userId: input.userId,
          allowWrites: mcpPlan.allowWrites,
          consentToken: null,
          maxToolCalls: mcpPlan.maxToolCalls,
        });
        const mcpOut = await executeMcpTool({
          name: "search_medical_knowledge",
          args: {
            query: [
              "Postpartum recovery and maternal mood support",
              input.postpartumWeek != null ? `week ${input.postpartumWeek}` : "",
              input.moodKey ?? "",
            ]
              .filter(Boolean)
              .join(" "),
            language: input.language,
            audienceType: "member",
            maxResults: 4,
            categories: ["postpartum", "education"],
          },
          ctx: mcpCtx,
        });
        if (mcpOut.ok && Array.isArray(mcpOut.data?.hits)) {
          const mcpCtxText = (mcpOut.data.hits as Array<{ source?: string; content?: string }>)
            .map((h, i) => `[MCP-${i + 1}] (${h.source ?? "knowledge"})\n${h.content ?? ""}`)
            .join("\n\n---\n\n");
          if (mcpCtxText.trim()) {
            ragContext = [ragContext, mcpCtxText].filter(Boolean).join("\n\n---\n\n");
          }
        }
      }
    } catch (e) {
      console.warn("[postpartum insights] MCP:", e);
    }
  }

  let value: PostpartumInsightsPayload;
  try {
    const body = await generatePostpartumAiJson({
      ragContext,
      postpartumWeek: input.postpartumWeek,
      moodKey: input.moodKey,
      language: input.language,
      pregnancyStatus: input.pregnancyStatus,
    });
    value = { ...body, source: "ai" };
  } catch (e) {
    console.warn("[postpartum insights] model:", e);
    value = {
      ...staticPostpartumFallback({
        postpartumWeek: input.postpartumWeek,
        moodKey: input.moodKey,
      }),
      source: "fallback",
    };
  }

  insightCache.set(key, { expires: now + CACHE_MS, value });
  if (insightCache.size > 400) {
    const cutoff = now;
    for (const [k, v] of insightCache) {
      if (v.expires <= cutoff) insightCache.delete(k);
    }
  }

  return value;
}
