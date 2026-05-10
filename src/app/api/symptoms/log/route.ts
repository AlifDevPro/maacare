import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, validationJsonResponse, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  symptomCodes: z.array(z.string().min(1).max(120)).max(50),
  title: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  severity: z.number().int().min(1).max(10),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "8") || 8, 30);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("symptom_logs")
      .select("id, logged_at, title, severity, symptom_codes")
      .eq("user_id", session.id)
      .order("logged_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[symptoms/log] list:", error);
      return failJson(500, "Could not load symptom logs.");
    }

    return Response.json({
      logs: (data ?? []).map((r) => ({
        id: r.id as string,
        loggedAt: r.logged_at as string,
        title: (r.title as string | null) ?? null,
        severity: (r.severity as number | null) ?? null,
        symptomCodes: ((r.symptom_codes as string[] | null) ?? []),
      })),
    });
  } catch (e) {
    return serverErrorJson("symptoms_log GET", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to save symptom log.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("symptom_logs")
      .insert({
        user_id: session.id,
        symptom_codes: parsed.data.symptomCodes,
        title: parsed.data.title?.trim() || null,
        description: parsed.data.description?.trim() || null,
        severity: parsed.data.severity,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[symptoms/log] insert:", error);
      return failJson(500, "Could not save symptom log.");
    }

    return Response.json({ id: data.id as string });
  } catch (e) {
    return serverErrorJson("symptoms_log POST", e);
  }
}

