/** Allows only same-origin relative paths (prevents open redirects after login). */
export function safeInternalPath(
  next: string | null | undefined,
  fallback = "/app",
): string {
  if (next == null || typeof next !== "string") return fallback;
  const t = next.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  return t;
}
