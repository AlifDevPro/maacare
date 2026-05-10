import { NextRequest } from "next/server";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { generateChatReply } from "@/lib/gemini/chat";
import { searchKnowledge } from "@/lib/rag/service";

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

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const weekRaw = req.nextUrl.searchParams.get("week");
    const week = weekRaw ? Math.max(1, Math.min(40, Number(weekRaw) || 0)) : null;

    const query = week
      ? `Pregnancy week ${week} daily meal suggestions with maternal nutrition guidance.`
      : "Daily pregnancy meal suggestions with maternal nutrition guidance.";

    const hits = await searchKnowledge(query, {
      limit: 6,
      categories: ["food"],
    });
    if (hits.length === 0) {
      return Response.json({ meals: FALLBACK_MEALS, source: "fallback" });
    }

    const context = hits
      .map((h, i) => `[${i + 1}] ${h.content}`)
      .join("\n\n---\n\n");

    const systemInstruction = [
      "You are MaaCare nutrition planner.",
      "Using ONLY provided FOOD context, produce exactly 3 items: Breakfast, Lunch, Dinner.",
      "Return ONLY JSON array with objects: label, body, tag.",
      "body: one short meal suggestion; tag: nutrient focus like 'Iron · Protein'.",
      "",
      "FOOD CONTEXT:",
      context,
    ].join("\n");

    const userMessage = `Create daily meal suggestions${week ? ` for pregnancy week ${week}` : ""}.`;
    const text = await generateChatReply({ systemInstruction, userMessage });
    const json = extractJsonBlock(text);
    const parsed = json ? JSON.parse(json) : null;
    const meals = coerceMeals(parsed);
    if (meals.length !== 3) {
      return Response.json({ meals: FALLBACK_MEALS, source: "fallback" });
    }

    return Response.json({ meals, source: "food-rag" });
  } catch (e) {
    return serverErrorJson("planner_food GET", e);
  }
}
