import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const remindersSchema = z.object({
  water: z.boolean(),
  meals: z.boolean(),
  walk: z.boolean(),
});

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  waterGlasses: z.number().int().min(0).max(20),
  tasks: z.record(z.string(), z.boolean()),
  reminders: remindersSchema,
  completed: z.boolean(),
  completionPercent: z.number().int().min(0).max(100),
});

function toDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const date = req.nextUrl.searchParams.get("date") ?? toDateKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return failJson(400, "Invalid date.");

    const supabase = await createSupabaseServerClient();
    const [{ data: entry, error: entryErr }, { data: history, error: historyErr }] = await Promise.all([
      supabase
        .from("planner_daily_logs")
        .select("plan_date, water_glasses, tasks, reminders, completed, completion_percent")
        .eq("user_id", session.id)
        .eq("plan_date", date)
        .maybeSingle(),
      supabase
        .from("planner_daily_logs")
        .select("plan_date, completion_percent, water_glasses")
        .eq("user_id", session.id)
        .order("plan_date", { ascending: false })
        .limit(7),
    ]);

    if (entryErr || historyErr) {
      console.error("[planner/daily] GET:", entryErr ?? historyErr);
      return failJson(500, "Could not load planner data.");
    }

    return Response.json({
      entry: entry
        ? {
            date: entry.plan_date as string,
            waterGlasses: (entry.water_glasses as number) ?? 0,
            tasks: (entry.tasks as Record<string, boolean> | null) ?? {},
            reminders:
              (entry.reminders as { water?: boolean; meals?: boolean; walk?: boolean } | null) ?? null,
            completed: (entry.completed as boolean) ?? false,
            completionPercent: (entry.completion_percent as number) ?? 0,
          }
        : null,
      history: (history ?? []).map((r) => ({
        date: r.plan_date as string,
        completionPercent: (r.completion_percent as number) ?? 0,
        waterGlasses: (r.water_glasses as number) ?? 0,
      })),
    });
  } catch (e) {
    return serverErrorJson("planner_daily GET", e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const { error: ensureErr } = await supabase.rpc("ensure_profile_for_current_user");
    if (ensureErr) {
      console.warn("[planner/daily] ensure_profile:", ensureErr.message);
    }

    const data = parsed.data;
    const { error: upsertErr } = await supabase.from("planner_daily_logs").upsert(
      {
        user_id: session.id,
        plan_date: data.date,
        water_glasses: data.waterGlasses,
        tasks: data.tasks,
        reminders: data.reminders,
        completed: data.completed,
        completion_percent: data.completionPercent,
      },
      { onConflict: "user_id,plan_date" },
    );
    if (upsertErr) {
      console.error("[planner/daily] PUT upsert:", upsertErr);
      return failJson(500, "Could not save planner data.");
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const cutoffDate = toDateKey(cutoff);
    const { error: pruneErr } = await supabase
      .from("planner_daily_logs")
      .delete()
      .eq("user_id", session.id)
      .lt("plan_date", cutoffDate);
    if (pruneErr) {
      console.warn("[planner/daily] PUT prune:", pruneErr.message);
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("planner_daily PUT", e);
  }
}

