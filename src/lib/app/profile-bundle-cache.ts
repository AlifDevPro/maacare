import { cache } from "react";

import type { ProfileBundle } from "@/app/profile/profile-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { loadProfileBundle } from "./profile-bundle-data";

/** Per-request dedupe (calls `cookies()` only outside any `unstable_cache` scope). */
export const getProfileBundleCached = cache(async (userId: string): Promise<ProfileBundle> => {
  const supabase = await createSupabaseServerClient();
  return loadProfileBundle(supabase, userId);
});
