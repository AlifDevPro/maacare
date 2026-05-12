import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { resolvePublicOrigin } from "@/lib/auth/public-origin";
import { createSupabaseAuthRouteHandler } from "@/lib/supabase/route-handler-client";

const bodySchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return validationJsonResponse(parsed.error);
    }

    const origin = resolvePublicOrigin(req);
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/app")}`;

    const { supabase, applyAuthCookies } = createSupabaseAuthRouteHandler(req);

    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email.toLowerCase().trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo,
      },
    });

    if (error) {
      console.warn("[auth/send-login-otp]", error.message);
      const notFound =
        error.message.toLowerCase().includes("signups not allowed") ||
        error.message.toLowerCase().includes("user not found") ||
        error.code === "otp_disabled";
      if (notFound) {
        return failJson(
          400,
          "No account found for that email, or passwordless sign-in is disabled. Try signing up or use your password.",
        );
      }
      return failJson(400, error.message || "Could not send a code. Try again in a moment.");
    }

    return applyAuthCookies(
      NextResponse.json({
        ok: true,
        message: "Check your email for a sign-in code or link.",
      }),
    );
  } catch (err) {
    if (err instanceof SyntaxError) {
      return failJson(400, "Request body must be valid JSON.");
    }
    return serverErrorJson("auth/send-login-otp", err);
  }
}
