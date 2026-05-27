import { NextRequest } from "next/server";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { buildLanguagePromptLines, normalizeUiLanguagePrior } from "@/lib/ai/language";
import { composeSystemPrompt } from "@/lib/ai/prompt-composer";
import { enforceNaturalResponseQuality } from "@/lib/ai/quality-guard";
import { buildNaturalStyleRules, buildSharedIdentityRules } from "@/lib/ai/prompts/shared";
import { planResponseForIntent } from "@/lib/ai/response-planner";
import { executeMcpTool } from "@/lib/ai/mcp/gateway";
import { buildToolCallContext, mcpPlanForRoute } from "@/lib/ai/mcp/policy";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { generateChatReply } from "@/lib/gemini/chat";
import { searchKnowledge } from "@/lib/rag/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MealSuggestion = {
  label: "Breakfast" | "Lunch" | "Dinner";
  body: string;
  tag: string;
};

const FALLBACK_MEALS: MealSuggestion[] = [
  { label: "Breakfast", body: "Oats with banana, almonds, milk", tag: "Iron · Calcium" },
  { label: "Lunch", body: "Brown rice, lentils, spinach, fish curry", tag: "Protein · Iron" },
  { label: "Dinner", body: "Chapati, mixed vegetables, yogurt", tag: "Calcium · Fiber" },
];

function extractJsonBlock(text: string): string | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

function coerceMeals(input: unknown): MealSuggestion[] {
  if (!Array.isArray(input)) return [];
  const valid: MealSuggestion[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const label = String(row.label ?? "");
    if (label !== "Breakfast" && label !== "Lunch" && label !== "Dinner") continue;
    const body = String(row.body ?? "").trim();
    const tag = String(row.tag ?? "").trim();
    if (!body || !tag) continue;
    valid.push({ label, body, tag });
  }
  return valid;
}

async function persistMealsForToday(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  meals: MealSuggestion[],
  source: string,
) {
  const planDate = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("planner_food_suggestions").upsert(
    {
      user_id: userId,
      plan_date: planDate,
      meals,
      source,
    },
    { onConflict: "user_id,plan_date" },
  );
  if (error) console.warn("[planner_food] persist meals", error.message);
}

function avoidRepeatPromptFromPrior(prior: { meals: unknown }[] | null | undefined): string {
  const lines: string[] = [];
  for (const row of prior ?? []) {
    const arr = coerceMeals(row.meals);
    for (const m of arr) lines.push(`${m.label}: ${m.body}`);
  }
  if (lines.length === 0) return "";
  const capped = lines.slice(0, 24);
  return [
    "The member already saw these meal ideas in the last 7 days. Generate clearly different dishes, ingredients, and cooking styles (still practical for home cooking):",
    ...capped,
  ].join("\n");
}

function yesterdayMealsPrompt(row: { meals: unknown } | null | undefined): string {
  if (!row) return "";
  const arr = coerceMeals(row.meals);
  if (arr.length === 0) return "";
  return [
    "Yesterday's planned meals for this member — do NOT repeat the same main dishes or identical ingredients; rotate cuisines and proteins while staying culturally appropriate and practical:",
    ...arr.map((m) => `${m.label}: ${m.body}`),
  ].join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const supabase = await createSupabaseServerClient();
    const uid = session.id;
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("language")
      .eq("id", uid)
      .maybeSingle();
    const uiLang = normalizeUiLanguagePrior((profileRow?.language as string | null) ?? null);
    const languageBlock = buildLanguagePromptLines({
      ietfLanguageTag: uiLang ?? "en",
      languageHintForPrompt: uiLang === "bn" ? "Bengali (Bangla)" : "English",
    });
    const responsePlan = planResponseForIntent({
      intent: {
        family: "planning",
        goal: "Generate daily pregnancy meal plan",
        responseMode: "answer_with_context",
        confidence: 0.96,
        needsClarification: false,
      },
      ietfLanguageTag: uiLang ?? "en",
      hasReportContext: false,
      hasNearbyContext: false,
    });
    const mcpEnabled = process.env.MCP_ENABLED === "1";
    const consentToken = req.nextUrl.searchParams.get("consentToken");
    const mcpPlan = mcpPlanForRoute({
      route: "planner_food",
      intentFamily: "planning",
      requestedTools: ["get_user_context", "search_medical_knowledge"],
      consentToken,
    });
    const mcpCtx = buildToolCallContext({
      route: "planner_food",
      intentFamily: "planning",
      userId: uid,
      allowWrites: mcpPlan.allowWrites,
      consentToken,
      maxToolCalls: mcpPlan.maxToolCalls,
    });
    let mcpKnowledgeContext = "";

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 7);
    const sinceStr = since.toISOString().slice(0, 10);
    const { data: priorRows } = await supabase
      .from("planner_food_suggestions")
      .select("meals")
      .eq("user_id", uid)
      .gte("plan_date", sinceStr)
      .order("plan_date", { ascending: false });

    const yest = new Date();
    yest.setUTCDate(yest.getUTCDate() - 1);
    const yesterdayStr = yest.toISOString().slice(0, 10);
    const { data: yesterdayRow } = await supabase
      .from("planner_food_suggestions")
      .select("meals")
      .eq("user_id", uid)
      .eq("plan_date", yesterdayStr)
      .maybeSingle();

    const avoidBlock = avoidRepeatPromptFromPrior(priorRows ?? null);
    const yesterdayBlock = yesterdayMealsPrompt(yesterdayRow ?? null);

    const weekRaw = req.nextUrl.searchParams.get("week");
    const week = weekRaw ? Math.max(1, Math.min(40, Number(weekRaw) || 0)) : null;

    const query = week
      ? `Pregnancy week ${week} daily meal suggestions with maternal nutrition guidance.`
      : "Daily pregnancy meal suggestions with maternal nutrition guidance.";
    if (mcpEnabled && mcpPlan.allowedTools.includes("search_medical_knowledge")) {
      const mcpOut = await executeMcpTool({
        name: "search_medical_knowledge",
        args: {
          query,
          language: uiLang ?? "en",
          audienceType: "member",
          maxResults: 6,
          categories: ["food"],
        },
        ctx: mcpCtx,
      });
      if (mcpOut.ok && Array.isArray(mcpOut.data?.hits)) {
        mcpKnowledgeContext = (mcpOut.data.hits as Array<{ content?: string }>)
          .map((h, i) => `[MCP-${i + 1}] ${h.content ?? ""}`)
          .join("\n");
      }
    }

    const hits = await searchKnowledge(query, {
      limit: 6,
      categories: ["food"],
    });
    if (hits.length === 0) {
      await persistMealsForToday(supabase, uid, FALLBACK_MEALS, "fallback");
      return Response.json({ meals: FALLBACK_MEALS, source: "fallback" });
    }

    const context = hits
      .map((h, i) => `[${i + 1}] ${h.content}`)
      .join("\n\n---\n\n");

    const systemInstruction = composeSystemPrompt(
      buildSharedIdentityRules(),
      buildNaturalStyleRules(),
      responsePlan.systemRules,
      "You are MaaCare nutrition planner.",
      "Using ONLY provided FOOD context, produce exactly 3 items: Breakfast, Lunch, Dinner.",
      "Return ONLY JSON array with objects: label, body, tag.",
      "body: one short meal suggestion; tag: nutrient focus like 'Iron · Protein'.",
      languageBlock,
      avoidBlock ? `${avoidBlock}\n` : "",
      yesterdayBlock ? `${yesterdayBlock}\n` : "",
      mcpKnowledgeContext ? `MCP FOOD CONTEXT:\n${mcpKnowledgeContext}\n` : "",
      "FOOD CONTEXT:",
      context,
    );

    const userMessage = `Create daily meal suggestions${week ? ` for pregnancy week ${week}` : ""}.`;
    const text = await generateChatReply({ systemInstruction, userMessage });
    const json = extractJsonBlock(text);
    const parsed = json ? JSON.parse(json) : null;
    const meals = coerceMeals(parsed).map((m) => ({
      ...m,
      body: enforceNaturalResponseQuality(m.body),
      tag: enforceNaturalResponseQuality(m.tag),
    }));
    if (meals.length !== 3) {
      await persistMealsForToday(supabase, uid, FALLBACK_MEALS, "fallback");
      return Response.json({ meals: FALLBACK_MEALS, source: "fallback" });
    }

    await persistMealsForToday(supabase, uid, meals, "food-rag");
    let actionResult: { ok: boolean; error: string | null } | null = null;
    if (
      mcpEnabled &&
      req.nextUrl.searchParams.get("action") === "create_reminder" &&
      mcpPlanForRoute({
        route: "planner_food",
        intentFamily: "planning",
        requestedTools: ["create_care_reminder"],
        consentToken,
      }).allowWrites
    ) {
      const createOut = await executeMcpTool({
        name: "create_care_reminder",
        args: {
          userId: uid,
          title: "Meal plan follow-up",
          timeIso: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          channel: "in_app",
          consentToken: consentToken ?? "",
        },
        ctx: mcpCtx,
      });
      actionResult = { ok: createOut.ok, error: createOut.error };
    }

    return Response.json({ meals, source: "food-rag", ...(actionResult ? { action: actionResult } : {}) });
  } catch (e) {
    return serverErrorJson("planner_food GET", e);
  }
}
