import { NextResponse } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { generateChatReply } from "@/lib/gemini/chat";
import { getGeminiApiKeys, getGroqApiKeys } from "@/lib/gemini/keys";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

const orderResponseSchema = z.object({
  orderedUserIds: z.array(z.string().uuid()),
});

export async function POST() {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    if (getGeminiApiKeys().length === 0 && getGroqApiKeys().length === 0) {
      return failJson(503, "AI keys are not configured.");
    }

    const svc = tryCreateSupabaseServiceClient();
    if (!svc) return failJson(503, "Server missing SUPABASE_SERVICE_ROLE_KEY.");

    const { data, error } = await svc
      .from("developer_team_profiles")
      .select("user_id, job_title, bio, profiles(display_name)")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[suggest-order] load", error);
      return failJson(500, "Could not load team members.");
    }

    type Row = { user_id: string; job_title: string; bio: string; profiles: { display_name: string } | { display_name: string }[] | null };
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) {
      return NextResponse.json({ orderedUserIds: [] as string[], note: "No team members yet." });
    }

    const payload = rows.map((r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        userId: r.user_id,
        displayName: p?.display_name ?? "",
        jobTitle: (r.job_title ?? "").trim(),
        bioSnippet: (r.bio ?? "").trim().slice(0, 280),
      };
    });

    const systemInstruction = [
      "You help order a public Meet the team section for a maternal health product.",
      "Return ONLY valid JSON (no markdown) with this exact shape:",
      '{"orderedUserIds":["<uuid>", ...]}',
      "Rules:",
      "- Include every userId from the input exactly once.",
      "- Order for a professional landing page: project/product leadership and senior technical roles first,",
      "  then other engineers, then design/content/support as applicable.",
      "- Infer seniority from job titles and short bios; when unclear, keep a stable order close to the input list.",
    ].join("\n");

    const reply = await generateChatReply({
      systemInstruction,
      userMessage: `Team members (JSON array):\n${JSON.stringify(payload, null, 2)}`,
    });

    const block = extractJsonObject(reply.trim());
    if (!block) {
      return failJson(422, "AI did not return parseable JSON. Try again or set order manually.");
    }

    let parsed: z.infer<typeof orderResponseSchema>;
    try {
      const raw = JSON.parse(block) as unknown;
      const r = orderResponseSchema.safeParse(raw);
      if (!r.success) {
        return failJson(422, "AI JSON did not match the expected shape.");
      }
      parsed = r.data;
    } catch {
      return failJson(422, "Could not parse AI JSON.");
    }

    const inputSet = new Set(rows.map((r) => r.user_id));
    const out = parsed.orderedUserIds.filter((id) => inputSet.has(id));
    for (const id of inputSet) {
      if (!out.includes(id)) out.push(id);
    }

    return NextResponse.json({ orderedUserIds: out });
  } catch (e) {
    return serverErrorJson("suggest_order", e);
  }
}
