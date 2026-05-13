import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProfileBundle } from "@/app/profile/profile-types";
import { estimatedDueDateFromLmp, resolveGestationalWeek } from "@/lib/profile/computed";
import { buildUserAppContext } from "@/lib/app/user-app-context";

export async function loadProfileBundle(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileBundle> {
  const [profileRes, healthRes, pregRes, allergyRes, conditionRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_health_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("pregnancy_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("allergies").select("id, name, allergen_type").eq("user_id", userId),
    supabase
      .from("medical_conditions")
      .select("condition_name")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  if (profileRes.error) {
    throw new Error(profileRes.error.message);
  }

  const profile = profileRes.data;
  const health = healthRes.data ?? null;
  const pregnancy = pregRes.data ?? null;

  const allergies = (allergyRes.data ?? []).map((a) => a.name);
  const conditions = (conditionRes.data ?? []).map((c) => c.condition_name);

  const lmp = pregnancy?.lmp_date ?? null;
  const eddFromLmp = lmp ? estimatedDueDateFromLmp(lmp) : null;

  const gestationalWeek = resolveGestationalWeek(pregnancy);

  const appContext = buildUserAppContext({
    primaryUseCase: profile?.primary_use_case as string | null | undefined,
    sex: profile?.sex as string | null | undefined,
    profession: profile?.profession as string | null | undefined,
  });

  return {
    profile,
    health,
    pregnancy,
    allergies,
    conditions,
    computed: {
      gestationalWeek,
      displayEdd: pregnancy?.edd_date ?? eddFromLmp ?? null,
      appContext,
    },
  };
}
