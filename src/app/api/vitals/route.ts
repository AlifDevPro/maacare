import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { loadVitalsList } from "@/lib/app/user-lists-data";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createSchema = z.object({
  systolicBp: z.number().int().min(50).max(260).optional(),
  diastolicBp: z.number().int().min(30).max(180).optional(),
  heartRateBpm: z.number().int().min(20).max(260).optional(),
  weightKg: z.number().min(10).max(400).optional(),
  temperatureC: z.number().min(30).max(45).optional(),
  glucoseMgDl: z.number().min(20).max(700).optional(),
  spo2Pct: z.number().int().min(50).max(100).optional(),
  notes: z.string().max(1000).optional(),
  recordedAt: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "30") || 30, 100);
    const supabase = await createSupabaseServerClient();

    try {
      const vitals = await loadVitalsList(supabase, session.id, limit);
      return Response.json({ vitals });
    } catch (e) {
      console.error("[vitals] GET:", e);
      return failJson(500, "Could not load vitals.");
    }
  } catch (e) {
    return serverErrorJson("vitals GET", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = createSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const body = parsed.data;
    const hasVitals =
      body.systolicBp != null ||
      body.diastolicBp != null ||
      body.heartRateBpm != null ||
      body.weightKg != null ||
      body.temperatureC != null ||
      body.glucoseMgDl != null ||
      body.spo2Pct != null;

    if (!hasVitals) return failJson(400, "Add at least one vital value.");

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("vital_signs")
      .insert({
        user_id: session.id,
        recorded_at: body.recordedAt ?? new Date().toISOString(),
        systolic_bp: body.systolicBp ?? null,
        diastolic_bp: body.diastolicBp ?? null,
        heart_rate_bpm: body.heartRateBpm ?? null,
        weight_kg: body.weightKg ?? null,
        temperature_c: body.temperatureC ?? null,
        glucose_mg_dl: body.glucoseMgDl ?? null,
        spo2_pct: body.spo2Pct ?? null,
        notes: body.notes?.trim() || null,
      })
      .select(
        "id, recorded_at, systolic_bp, diastolic_bp, heart_rate_bpm, weight_kg, temperature_c, glucose_mg_dl, spo2_pct, notes",
      )
      .single();

    if (error || !data) {
      console.error("[vitals] POST:", error);
      return failJson(500, "Could not save vitals.");
    }

    return Response.json({
      vital: {
        id: data.id as string,
        recordedAt: data.recorded_at as string,
        systolicBp: (data.systolic_bp as number | null) ?? null,
        diastolicBp: (data.diastolic_bp as number | null) ?? null,
        heartRateBpm: (data.heart_rate_bpm as number | null) ?? null,
        weightKg: (data.weight_kg as number | null) ?? null,
        temperatureC: (data.temperature_c as number | null) ?? null,
        glucoseMgDl: (data.glucose_mg_dl as number | null) ?? null,
        spo2Pct: (data.spo2_pct as number | null) ?? null,
        notes: (data.notes as string | null) ?? null,
      },
    });
  } catch (e) {
    return serverErrorJson("vitals POST", e);
  }
}

