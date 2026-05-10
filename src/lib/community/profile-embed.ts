/** Supabase may return an embedded `profiles` row as object or single-element array. */
export function unwrapProfileEmbed(p: unknown): {
  display_name: string;
  role: string;
  avatar_url: string | null;
  email?: string | null;
} | null {
  if (!p) return null;
  if (Array.isArray(p)) {
    const row = p[0];
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    return {
      display_name: typeof o.display_name === "string" ? o.display_name : "Member",
      role: typeof o.role === "string" ? o.role : "user",
      avatar_url: typeof o.avatar_url === "string" ? o.avatar_url : null,
      email: typeof o.email === "string" ? o.email : null,
    };
  }
  if (typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  return {
    display_name: typeof o.display_name === "string" ? o.display_name : "Member",
    role: typeof o.role === "string" ? o.role : "user",
    avatar_url: typeof o.avatar_url === "string" ? o.avatar_url : null,
    email: typeof o.email === "string" ? o.email : null,
  };
}
