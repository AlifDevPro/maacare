import type { NextRequest } from "next/server";

/** Public site origin for email redirect URLs (Supabase auth). */
export function resolvePublicOrigin(req: NextRequest): string {
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost = req.headers.get("x-forwarded-host");
  if (xfHost) {
    const proto = xfProto || (xfHost.includes("localhost") ? "http" : "https");
    return `${proto}://${xfHost}`.replace(/\/+$/, "");
  }

  const host = req.headers.get("host");
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https";
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  return new URL(req.url).origin.replace(/\/+$/, "");
}
