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
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

    const { supabase, applyAuthCookies } = createSupabaseAuthRouteHandler(req);

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email.toLowerCase().trim(), {
      redirectTo,
    });

    if (error) {
      console.warn("[auth/forgot-password]", error.message);
      const msg = error.message.toLowerCase();
      const rateLimited =
        msg.includes("rate") || msg.includes("too many") || (error.status ?? 0) === 429;
      if (rateLimited) {
        return failJson(
          429,
          "Too many reset attempts. Please wait a few minutes before trying again.",
        );
      }
      return failJson(
        503,
        error.message ||
          "We could not send the reset email. Check Supabase Auth email / SMTP settings and try again.",
      );
    }

    return applyAuthCookies(
      NextResponse.json({
        ok: true,
        message:
          "If an account exists for that email, we've sent a reset link. Check your inbox and spam folder.",
      }),
    );
  } catch (err) {
    if (err instanceof SyntaxError) {
      return failJson(400, "Request body must be valid JSON.");
    }
    return serverErrorJson("auth/forgot-password", err);
  }
}
