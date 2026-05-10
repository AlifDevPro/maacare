import { createSupabaseServerClient } from "@/lib/supabase/server";

import { resolvePublicUser } from "./profile";
import type { PublicUser } from "./types";

export type { PublicUser } from "./types";

export async function getSessionFromCookies(): Promise<PublicUser | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return resolvePublicUser(supabase, user);
}
