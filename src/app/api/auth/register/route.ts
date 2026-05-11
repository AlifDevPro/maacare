import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  validationJsonResponse,
  failJson,
  serverErrorJson,
  friendlyAuth,
} from "@/lib/api/error-response";
import { resolvePublicUser } from "@/lib/auth/profile";
import { createSupabaseAuthRouteHandler } from "@/lib/supabase/route-handler-client";

const bodySchema = z.object({
  name: z.string().min(1, "Name is required.").max(120, "Name is too long."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

function resolvePublicOrigin(req: NextRequest): string {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost = req.headers.get("x-forwarded-host");
  if (xfProto && xfHost) {
    return `${xfProto}://${xfHost}`.replace(/\/+$/, "");
  }

  const host = req.headers.get("host");
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https";
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  return new URL(req.url).origin.replace(/\/+$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return validationJsonResponse(parsed.error);
    }

    const { name, email, password } = parsed.data;
    const origin = resolvePublicOrigin(req);
    const emailRedirectTo = `${origin}/login`;

    const { supabase, applyAuthCookies } = createSupabaseAuthRouteHandler(req);

    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        emailRedirectTo,
        data: {
          display_name: name.trim(),
          name: name.trim(),
        },
      },
    });

    if (error) {
      const dup = error.message.toLowerCase().includes("already");
      if (dup) {
        return failJson(409, "This email is already registered. Try signing in instead.");
      }
      console.error("[auth/register] signUp:", error.message);
      return failJson(409, friendlyAuth.accountIncomplete);
    }

    if (!data.user) {
      console.error("[auth/register] no user returned from signUp");
      return failJson(500, friendlyAuth.accountIncomplete);
    }

    if (!data.session) {
      return applyAuthCookies(
        NextResponse.json({
          ok: true,
          needsEmailConfirmation: true,
          message:
            "We've sent you a confirmation email. Open the link inside, then come back and sign in.",
        }),
      );
    }

    const profileUser = await resolvePublicUser(supabase, data.user);

    return applyAuthCookies(NextResponse.json({ user: profileUser }));
  } catch (err) {
    if (err instanceof SyntaxError) {
      return failJson(400, "Request body must be valid JSON.");
    }
    return serverErrorJson("auth/register", err);
  }
}
