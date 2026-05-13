import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Paths that do not require a signed-in user (marketing + auth flows + emergency info). */
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
  "/emergency",
  "/auth/callback",
]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/** Product documentation (readable without sign-in; does not expose secrets). */
function isPublicDocsPath(pathname: string): boolean {
  return pathname === "/docs" || pathname.startsWith("/docs/");
}

function isPublicAuthApi(pathname: string): boolean {
  return pathname.startsWith("/api/auth/");
}

/** Anonymous signup assistance (rate-limited in route). */
function isPublicSignupApi(pathname: string): boolean {
  return pathname.startsWith("/api/signup/");
}

function shouldRedirectAuthedToApp(pathname: string): boolean {
  return pathname === "/" || pathname === "/login";
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const searchParams = request.nextUrl.searchParams;

  /**
   * Supabase may send users to the Site URL root with `?code=` when `redirect_to`
   * is not allowlisted. Forward to `/auth/callback` so PKCE exchange runs.
   * If `next` is missing, default to password reset (see `.env.example`).
   */
  if (pathname === "/" && searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    if (!url.searchParams.has("next")) {
      url.searchParams.set("next", "/reset-password");
    }
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    if (pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isAdminArea) {
    if (!user) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(login);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", request.url));
    }

    return response;
  }

  if (isPublicDocsPath(pathname)) {
    return response;
  }

  if (isPublicPath(pathname)) {
    if (user && shouldRedirectAuthedToApp(pathname)) {
      return NextResponse.redirect(new URL("/app", request.url));
    }
    return response;
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      if (isPublicAuthApi(pathname) || isPublicSignupApi(pathname)) {
        return response;
      }
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
