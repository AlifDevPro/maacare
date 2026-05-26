import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { buildLanguagePromptLines, normalizeUiLanguagePrior } from "@/lib/ai/language";
import { composeSystemPrompt } from "@/lib/ai/prompt-composer";
import { enforceNaturalResponseQuality } from "@/lib/ai/quality-guard";
import {
  buildMedicalSafetyRules,
  buildNaturalStyleRules,
  buildSharedIdentityRules,
} from "@/lib/ai/prompts/shared";
import { planResponseForIntent } from "@/lib/ai/response-planner";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { buildOneShotNearbyCatalogBlock } from "@/lib/bd-facilities/chat-nearby-context";
import { getGeminiApiKeys, getGroqApiKeys } from "@/lib/gemini/keys";
import { generateTextWithGeminiGroqFailover } from "@/lib/gemini/text-failover";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    if (getGeminiApiKeys().length === 0 && getGroqApiKeys().length === 0) {
      return failJson(503, "AI service is not configured.");
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return failJson(400, "Invalid location.");

    const { latitude, longitude } = parsed.data;
    const supabase = await createSupabaseServerClient();
    const catalog = await buildOneShotNearbyCatalogBlock(supabase, latitude, longitude);
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("language")
      .eq("id", session.id)
      .maybeSingle();
    const uiLang = normalizeUiLanguagePrior((profileRow?.language as string | null) ?? null);
    const languageBlock = buildLanguagePromptLines({
      ietfLanguageTag: uiLang ?? "en",
      languageHintForPrompt: uiLang === "bn" ? "Bengali (Bangla)" : "English",
    });
    const responsePlan = planResponseForIntent({
      intent: {
        family: "nearby_facilities",
        goal: "User requested nearby care options",
        responseMode: "answer_without_context",
        confidence: 0.95,
        needsClarification: false,
      },
      ietfLanguageTag: uiLang ?? "en",
      hasReportContext: false,
      hasNearbyContext: true,
    });

    const systemInstruction = composeSystemPrompt(
      buildSharedIdentityRules(),
      buildMedicalSafetyRules(),
      buildNaturalStyleRules(),
      responsePlan.systemRules,
      "The user used one-tap nearby help after sharing GPS. Reply ONCE — no follow-up questions unless critical safety.",
      "Use ONLY the CATALOG block below (real rows from the app database). Order your answer: **Clinics** first, then **Hospitals**, then **Pharmacies** — mirror the catalog sections.",
      "Use Markdown: ## headings and bullet lines with **name**, distance, and area/address when present.",
      "Do not invent phone numbers. If a section says none, say so briefly.",
      "End with one line: informational only; in emergencies call **999** (Bangladesh).",
      languageBlock,
    );

    const userMessage = ["CATALOG (clinics → hospitals → pharmacies):", "", catalog].join("\n");

    const out = await generateTextWithGeminiGroqFailover({
      systemInstruction,
      userMessage,
    });

    return Response.json({
      reply: enforceNaturalResponseQuality(out.text),
      provider: out.provider,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (raw.includes("all_providers_rate_limited")) {
      return Response.json(
        { error: "AI usage limit reached. Please wait about 1 minute and try again.", retryAfterSeconds: 60 },
        { status: 429 },
      );
    }
    return serverErrorJson("chat/nearby-once POST", e);
  }
}
