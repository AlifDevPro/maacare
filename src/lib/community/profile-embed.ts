/** Supabase may return an embedded `profiles` row as object or single-element array. */
export function unwrapProfileEmbed(p: unknown): {
  display_name: string;
  role: string;
  avatar_url: string | null;
  email?: string | null;
  profession?: string | null;
  verified_professional?: boolean;
} | null {
  if (!p) return null;
  const mapRow = (o: Record<string, unknown>) => {
    const rawProf = typeof o.profession === "string" ? o.profession : null;
    const profession =
      rawProf === "other" ? "student_researcher" : rawProf;
    return {
      display_name: typeof o.display_name === "string" ? o.display_name : "Member",
      role: typeof o.role === "string" ? o.role : "user",
      avatar_url: typeof o.avatar_url === "string" ? o.avatar_url : null,
      email: typeof o.email === "string" ? o.email : null,
      profession,
      verified_professional: o.verified_professional === true,
    };
  };
  if (Array.isArray(p)) {
    const row = p[0];
    if (!row || typeof row !== "object") return null;
    return mapRow(row as Record<string, unknown>);
  }
  if (typeof p !== "object") return null;
  return mapRow(p as Record<string, unknown>);
}
