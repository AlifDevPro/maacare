import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Route Handler auth client: captures Supabase cookie writes during signIn/signUp/signOut
 * and applies them to the final JSON response (required for Next.js App Router).
 */
export function createSupabaseAuthRouteHandler(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  }

  const pending: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        pending.push(...cookiesToSet);
      },
    },
  });

  function applyAuthCookies<T>(response: NextResponse<T>) {
    pending.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  return { supabase, applyAuthCookies };
}
