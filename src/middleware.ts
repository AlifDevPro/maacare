import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Supabase falls back to the configured "Site URL" root when `redirectTo` is not
 * allowlisted — links look like `https://www.maacare.xyz/?code=...` and never hit
 * `/auth/callback`, so the PKCE exchange never runs. Forward those requests.
 *
 * If `next` is missing (typical for misconfigured recovery links), default to
 * `/reset-password` so password reset completes. For email signup confirmation
 * misconfigured the same way, fix Supabase Redirect URLs so emails include
 * `next=/app` (see `.env.example`).
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname !== "/") {
    return NextResponse.next();
  }
  if (!searchParams.has("code")) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/auth/callback";
  if (!url.searchParams.has("next")) {
    url.searchParams.set("next", "/reset-password");
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/"],
};
