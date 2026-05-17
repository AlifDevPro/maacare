import type { AuthUser } from "@/lib/auth/types";

/** Dispatched on login/logout/profile auth updates; AuthSessionProvider invalidates session query. */
export const AUTH_EVENT = "maacare:auth";

export const authSessionQueryKey = ["auth", "session"] as const;

export async function refreshSession(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/session", { credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as { user: AuthUser | null };
  return data.user ?? null;
}

export function authSessionQueryOptions() {
  return {
    queryKey: authSessionQueryKey,
    queryFn: refreshSession,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  };
}
