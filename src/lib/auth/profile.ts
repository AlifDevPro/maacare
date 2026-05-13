import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { PublicUser } from "@/lib/auth/types";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

type ProfileRow = {
  display_name: string;
  email: string | null;
  role: string;
  language: string | null;
  avatar_url: string | null;
};

function mapRow(row: ProfileRow, authUserId: string, fallbackEmail: string | null): PublicUser {
  return {
    id: authUserId,
    name: row.display_name,
    email: row.email ?? fallbackEmail ?? "",
    role: row.role as PublicUser["role"],
    language: row.language === "bn" ? "bn" : "en",
    avatarUrl: row.avatar_url ?? null,
    isTeamDeveloper: false,
  };
}

async function fetchProfile(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, email, role, language, avatar_url")
    .eq("id", authUserId)
    .maybeSingle();

  if (error) {
    console.error("[profile] select failed:", error.code, error.message, error.details);
    return null;
  }
  if (!data) return null;
  return data as ProfileRow;
}

export function displayNameFromUser(authUser: Pick<User, "email" | "user_metadata">): string {
  const m = authUser.user_metadata as Record<string, unknown> | undefined;
  const fromMeta = (key: string) => {
    const v = m?.[key];
    return typeof v === "string" && v.trim() ? v.trim() : "";
  };
  return (
    fromMeta("display_name") ||
    fromMeta("name") ||
    (authUser.email ? authUser.email.split("@")[0] : "") ||
    "Member"
  );
}

function languageFromUser(authUser: Pick<User, "user_metadata">): "en" | "bn" {
  const m = authUser.user_metadata as Record<string, unknown> | undefined;
  const raw = m?.language;
  return raw === "bn" || raw === "en" ? raw : "en";
}

/** When the database row is missing or unreachable, still return a usable app user from the JWT. */
export function buildSyntheticPublicUser(authUser: User): PublicUser {
  return {
    id: authUser.id,
    name: displayNameFromUser(authUser),
    email: authUser.email ?? "",
    role: "user",
    language: languageFromUser(authUser),
    avatarUrl: null,
    isTeamDeveloper: false,
  };
}

/** Insert profile using JWT (needs profiles_insert_own RLS policy). */
async function insertProfileFallback(
  supabase: SupabaseClient,
  authUser: Pick<User, "id" | "email" | "user_metadata">,
): Promise<boolean> {
  const language = languageFromUser(authUser);

  const { error } = await supabase.from("profiles").insert({
    id: authUser.id,
    email: authUser.email ?? null,
    display_name: displayNameFromUser(authUser),
    role: "user",
    language,
  });

  if (error) {
    console.warn("[profile] JWT insert:", error.code, error.message);
    return false;
  }
  return true;
}

function logPostgrest(ctx: string, err: { message: string; code?: string; details?: string; hint?: string }) {
  console.error(`[profile] ${ctx}`, {
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
  });
}

/**
 * Service role: insert profile (minimal columns; rely on DB default for `role` except first account → admin).
 */
async function writeProfileWithServiceRole(
  authUser: Pick<User, "id" | "email" | "user_metadata">,
): Promise<ProfileRow | null> {
  const svc = tryCreateSupabaseServiceClient();
  if (!svc) {
    console.error(
      "[profile] Set SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase → Project Settings → API → service_role).",
    );
    return null;
  }

  const { count, error: countErr } = await svc
    .from("profiles")
    .select("id", { count: "exact", head: true });

  if (countErr) {
    logPostgrest("count profiles", countErr);
  }

  const isFirstAccount = (count ?? 0) === 0;
  const language = languageFromUser(authUser);

  const baseRow = {
    id: authUser.id,
    email: authUser.email ?? null,
    display_name: displayNameFromUser(authUser),
    language,
  };

  const insertPayload = isFirstAccount
    ? { ...baseRow, role: "admin" as const }
    : { ...baseRow };

  let { error: insErr } = await svc.from("profiles").insert(insertPayload);

  if (insErr) {
    logPostgrest("service insert", insErr);
    if (insErr.code === "23505" || insErr.message?.toLowerCase().includes("duplicate")) {
      // Row exists (race) — read it
    } else {
      const { error: upErr } = await svc.from("profiles").upsert(
        {
          ...baseRow,
          role: isFirstAccount ? "admin" : "user",
        },
        { onConflict: "id" },
      );
      if (upErr) {
        logPostgrest("service upsert fallback", upErr);
      }
    }
  }

  const { data, error: readErr } = await svc
    .from("profiles")
    .select("display_name, email, role, language, avatar_url")
    .eq("id", authUser.id)
    .maybeSingle();

  if (readErr) {
    logPostgrest("service read after write", readErr);
    return null;
  }
  if (!data) return null;
  return data as ProfileRow;
}

/**
 * Load profile; repair via RPC, JWT insert, service-role write.
 * Returns null only if every write/read path fails (caller may use {@link buildSyntheticPublicUser}).
 */
export async function loadProfileWithRepair(
  supabase: SupabaseClient,
  authUser: Pick<User, "id" | "email" | "user_metadata">,
): Promise<{ user: PublicUser | null }> {
  const existing = await fetchProfile(supabase, authUser.id);
  if (existing) {
    return { user: mapRow(existing, authUser.id, authUser.email ?? null) };
  }

  const { error: rpcErr } = await supabase.rpc("ensure_profile_for_current_user");
  if (!rpcErr) {
    const afterRpc = await fetchProfile(supabase, authUser.id);
    if (afterRpc) {
      return { user: mapRow(afterRpc, authUser.id, authUser.email ?? null) };
    }
  } else {
    console.warn("[profile] RPC ensure_profile_for_current_user:", rpcErr.message);
  }

  const inserted = await insertProfileFallback(supabase, authUser);
  if (inserted) {
    const afterInsert = await fetchProfile(supabase, authUser.id);
    if (afterInsert) {
      return { user: mapRow(afterInsert, authUser.id, authUser.email ?? null) };
    }
  }

  const raced = await fetchProfile(supabase, authUser.id);
  if (raced) {
    return { user: mapRow(raced, authUser.id, authUser.email ?? null) };
  }

  const svcRow = await writeProfileWithServiceRole(authUser);
  if (svcRow) {
    let jwtRow = await fetchProfile(supabase, authUser.id);
    if (!jwtRow) {
      jwtRow = svcRow;
    }
    return { user: mapRow(jwtRow, authUser.id, authUser.email ?? null) };
  }

  console.error("[profile] could not resolve profile for", authUser.id);
  return { user: null };
}

async function fetchIsTeamDeveloper(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("developer_team_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[profile] developer_team_profiles lookup:", error.message);
    return false;
  }
  return !!data;
}

/** Prefer database profile; fall back to JWT-only snapshot so auth never blocks on missing migrations/keys. */
export async function resolvePublicUser(
  supabase: SupabaseClient,
  authUser: User,
): Promise<PublicUser> {
  const { user } = await loadProfileWithRepair(supabase, authUser);
  const base = user ?? buildSyntheticPublicUser(authUser);
  if (!user) {
    console.warn("[profile] using JWT snapshot — add SUPABASE_SERVICE_ROLE_KEY or run Supabase migrations");
  }
  const isTeamDeveloper = await fetchIsTeamDeveloper(supabase, authUser.id);
  return { ...base, isTeamDeveloper };
}
