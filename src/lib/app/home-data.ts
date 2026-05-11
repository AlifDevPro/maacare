import type { SupabaseClient } from "@supabase/supabase-js";

import { estimatedDueDateFromLmp, resolveGestationalWeek } from "@/lib/profile/computed";
import type { HomeData } from "@/lib/app/home-types";
import { postpartumWeekFromBirth } from "@/lib/pregnancy";

export async function getHomeData(
  supabase: SupabaseClient,
  uid: string,
  displayNameFallback: string,
): Promise<HomeData> {
  const nowIso = new Date().toISOString();

  const [profileRes, pregnancyRes, vitalsRes, symptomRes, apptRes, apptCountRes, unreadRes] =
    await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle(),
      supabase
        .from("pregnancy_profiles")
        .select("pregnancy_status, lmp_date, edd_date, gestational_age_weeks, baby_birth_date")
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
        .select("id, logged_at, title, severity")
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

  if (profileRes.error) console.warn("[home] profile:", profileRes.error.message);
  if (pregnancyRes.error) console.warn("[home] pregnancy:", pregnancyRes.error.message);
  if (vitalsRes.error) console.warn("[home] vitals:", vitalsRes.error.message);
  if (symptomRes.error) console.warn("[home] symptoms:", symptomRes.error.message);
  if (apptRes.error) console.warn("[home] appointment:", apptRes.error.message);
  if (apptCountRes.error) console.warn("[home] appointment count:", apptCountRes.error.message);
  if (unreadRes.error) console.warn("[home] notifications unread:", unreadRes.error.message);

  const pregnancy = pregnancyRes.data ?? null;
  const lmp = pregnancy?.lmp_date ?? null;
  const eddFromLmp = lmp ? estimatedDueDateFromLmp(lmp) : null;

  const gestationalWeek = resolveGestationalWeek(pregnancy);

  const babyBirthDate = (pregnancy as { baby_birth_date?: string | null } | null)?.baby_birth_date ?? null;
  const postpartumWeek = postpartumWeekFromBirth(babyBirthDate);

  return {
    profile: {
      displayName: profileRes.data?.display_name ?? displayNameFallback ?? "Member",
    },
    pregnancy: pregnancy
      ? {
          status: pregnancy.pregnancy_status,
          gestationalWeek,
          displayEdd: pregnancy.edd_date ?? eddFromLmp ?? null,
          babyBirthDate,
          postpartumWeek,
        }
      : {
          status: null,
          gestationalWeek: null,
          displayEdd: null,
          babyBirthDate: null,
          postpartumWeek: null,
        },
    vitals: (vitalsRes.data as HomeData["vitals"]) ?? null,
    latestSymptom: (symptomRes.data as HomeData["latestSymptom"]) ?? null,
    upcomingAppointment: (apptRes.data as HomeData["upcomingAppointment"]) ?? null,
    upcomingAppointmentsCount: apptCountRes.count ?? 0,
    unreadNotificationsCount: unreadRes.count ?? 0,
    serverTime: nowIso,
  };
}

