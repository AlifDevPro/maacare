import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { postpartumWeekFromBirth } from "@/lib/pregnancy";
import { coerceGestationalWeek } from "@/lib/profile/computed";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Nudge = { id: string; message: string; href: string; priority: number };

function hashPick(userId: string, day: string, nudgeId: string, variants: number): number {
  let h = 0;
  const s = `${userId}:${day}:${nudgeId}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h) % variants;
}

const VITALS_MESSAGES = [
  "A quick vitals check-in helps your care story stay current — log blood pressure or temperature when you can.",
  "If it has been a few days since your last reading, consider adding vitals so patterns are easier to spot.",
  "Two minutes to log vitals can make future visits smoother — want to add a reading now?",
] as const;

const BIRTH_DATE_MESSAGES = [
  "Adding your baby’s birth date unlocks week-by-week postpartum guidance tailored to you.",
  "We can personalize recovery tips once your birth date is saved — update your profile when you have a moment.",
  "Your postpartum week label stays sharper with a birth date on file — mind updating it in your profile?",
] as const;

const PREGNANCY_DATES_MESSAGES = [
  "A due date or last period helps us align tips with your trimester — your profile can hold that in one tap.",
  "When gestational timing is set, home cards and reminders fit better — want to fill that in?",
  "Small profile details (EDD or LMP) go a long way for tailored guidance.",
] as const;

const LMP_REFINE_MESSAGES = [
  "You already have a due date or week on file — adding your last period date helps keep gestational week labels more consistent.",
  "If you know your last menstrual period, saving it in your profile fine-tunes trimester tips alongside your due date.",
  "One more detail: last period (LMP) pairs nicely with your EDD so the app can double-check timing — update profile when you can.",
] as const;

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const supabase = await createSupabaseServerClient();
    const nowIso = new Date().toISOString();
    const day = nowIso.slice(0, 10);

    const [{ data: preg }, { data: lastVital }] = await Promise.all([
      supabase
        .from("pregnancy_profiles")
        .select("pregnancy_status, lmp_date, edd_date, gestational_age_weeks, baby_birth_date")
        .eq("user_id", session.id)
        .maybeSingle(),
      supabase
        .from("vital_signs")
        .select("recorded_at")
        .eq("user_id", session.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const candidates: Nudge[] = [];

    const status = (preg as { pregnancy_status?: string | null } | null)?.pregnancy_status ?? null;
    const babyBirth = (preg as { baby_birth_date?: string | null } | null)?.baby_birth_date ?? null;
    const lmp = (preg as { lmp_date?: string | null } | null)?.lmp_date ?? null;
    const edd = (preg as { edd_date?: string | null } | null)?.edd_date ?? null;
    const gaWeeks = (preg as { gestational_age_weeks?: number | null } | null)?.gestational_age_weeks ?? null;
    const gw = coerceGestationalWeek(gaWeeks);

    const lastAt = (lastVital as { recorded_at?: string | null } | null)?.recorded_at ?? null;
    let vitalsStale = true;
    if (lastAt) {
      const t = new Date(lastAt).getTime();
      if (!Number.isNaN(t)) {
        const days = (Date.now() - t) / (24 * 60 * 60 * 1000);
        vitalsStale = days > 6.5;
      }
    }

    if (vitalsStale) {
      const i = hashPick(session.id, day, "vitals", VITALS_MESSAGES.length);
      candidates.push({
        id: "vitals_stale",
        message: VITALS_MESSAGES[i] ?? VITALS_MESSAGES[0],
        href: "/vitals",
        priority: status === "postpartum" ? 88 : 72,
      });
    }

    if (status === "postpartum" && !babyBirth) {
      const i = hashPick(session.id, day, "birth", BIRTH_DATE_MESSAGES.length);
      candidates.push({
        id: "missing_birth_date",
        message: BIRTH_DATE_MESSAGES[i] ?? BIRTH_DATE_MESSAGES[0],
        href: "/profile/edit",
        priority: 95,
      });
    }

    if (status === "pregnant" && !lmp && !edd && gw == null) {
      const i = hashPick(session.id, day, "pregdates", PREGNANCY_DATES_MESSAGES.length);
      candidates.push({
        id: "missing_pregnancy_dates",
        message: PREGNANCY_DATES_MESSAGES[i] ?? PREGNANCY_DATES_MESSAGES[0],
        href: "/profile/edit",
        priority: 90,
      });
    }

    if (status === "pregnant" && !lmp && (Boolean(edd) || gw != null)) {
      const i = hashPick(session.id, day, "lmprefine", LMP_REFINE_MESSAGES.length);
      candidates.push({
        id: "add_lmp_for_week_accuracy",
        message: LMP_REFINE_MESSAGES[i] ?? LMP_REFINE_MESSAGES[0],
        href: "/profile/edit",
        priority: 86,
      });
    }

    if (status === "postpartum" && babyBirth && postpartumWeekFromBirth(babyBirth) == null) {
      const i = hashPick(session.id, day, "birth", BIRTH_DATE_MESSAGES.length);
      candidates.push({
        id: "birth_date_invalid",
        message: BIRTH_DATE_MESSAGES[i] ?? BIRTH_DATE_MESSAGES[0],
        href: "/profile/edit",
        priority: 85,
      });
    }

    candidates.sort((a, b) => b.priority - a.priority);
    const top = candidates[0] ?? null;

    return Response.json({ nudge: top, serverDay: day });
  } catch (e) {
    return serverErrorJson("health_nudges GET", e);
  }
}
