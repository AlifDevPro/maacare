/** Allows only same-origin relative paths (prevents open redirects after login). */
export function safeInternalPath(
  next: string | null | undefined,
  fallback = "/app",
): string {
  if (next == null || typeof next !== "string") return fallback;
  let t = next.trim();
  if (t.startsWith("//") || t.includes("..")) return fallback;
  if (!t.startsWith("/")) {
    // Some redirects pass `next=app` without a leading slash; treat as same-origin path only.
    if (/^[A-Za-z0-9/_-]+$/.test(t)) {
      t = `/${t}`;
    } else {
      return fallback;
    }
  }
  return t;
}
