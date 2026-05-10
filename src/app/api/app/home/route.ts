import { NextRequest } from "next/server";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { gestationalWeekFromLmp, estimatedDueDateFromLmp } from "@/lib/profile/computed";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const supabase = await createSupabaseServerClient();
    const uid = session.id;

    const nowIso = new Date().toISOString();

    const [
      profileRes,
      pregnancyRes,
      vitalsRes,
      symptomRes,
      apptRes,
      apptCountRes,
      unreadRes,
    ] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle(),
      supabase
        .from("pregnancy_profiles")
        .select("pregnancy_status, lmp_date, edd_date, gestational_age_weeks")
        .eq("user_id", uid)
        .maybeSingle(),
      supabase
        .from("vital_signs")
        .select(
          "recorded_at, systolic_bp, diastolic_bp, heart_rate_bpm, weight_kg, temperature_c, glucose_mg_dl, spo2_pct",
        )
        .eq("user_id", uid)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("symptom_logs")
        .select("logged_at, title, severity")
        .eq("user_id", uid)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("appointments")
        .select("id, title, scheduled_at, provider_name, location, appointment_type")
        .eq("user_id", uid)
        .eq("status", "scheduled")
        .gte("scheduled_at", nowIso)
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("status", "scheduled")
        .gte("scheduled_at", nowIso),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", uid)
        .is("read_at", null),
    ]);

    if (profileRes.error) {
      console.warn("[app/home] profile:", profileRes.error.message);
    }
    if (pregnancyRes.error) {
      console.warn("[app/home] pregnancy:", pregnancyRes.error.message);
    }
    if (vitalsRes.error) {
      console.warn("[app/home] vitals:", vitalsRes.error.message);
    }
    if (symptomRes.error) {
      console.warn("[app/home] symptoms:", symptomRes.error.message);
    }
    if (apptRes.error) {
      console.warn("[app/home] appointment:", apptRes.error.message);
    }
    if (apptCountRes.error) {
      console.warn("[app/home] appointment count:", apptCountRes.error.message);
    }
    if (unreadRes.error) {
      console.warn("[app/home] notifications unread:", unreadRes.error.message);
    }

    const pregnancy = pregnancyRes.data ?? null;
    const lmp = pregnancy?.lmp_date ?? null;
    const weeksFromLmp = gestationalWeekFromLmp(lmp ?? undefined);
    const eddFromLmp = lmp ? estimatedDueDateFromLmp(lmp) : null;

    const gestationalWeek =
      pregnancy?.gestational_age_weeks != null ? pregnancy.gestational_age_weeks : weeksFromLmp;

    return Response.json({
      profile: {
        displayName: profileRes.data?.display_name ?? session.name ?? "Member",
      },
      pregnancy: pregnancy
        ? {
            status: pregnancy.pregnancy_status,
            gestationalWeek,
            displayEdd: pregnancy.edd_date ?? eddFromLmp ?? null,
          }
        : {
            status: null,
            gestationalWeek: null,
            displayEdd: null,
          },
      vitals: vitalsRes.data ?? null,
      latestSymptom: symptomRes.data ?? null,
      upcomingAppointment: apptRes.data ?? null,
      upcomingAppointmentsCount: apptCountRes.count ?? 0,
      unreadNotificationsCount: unreadRes.count ?? 0,
      serverTime: nowIso,
    });
  } catch (e) {
    return serverErrorJson("app_home GET", e);
  }
}

