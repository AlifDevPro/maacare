import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  validationJsonResponse,
  failJson,
  serverErrorJson,
  friendlyAuth,
} from "@/lib/api/error-response";
import { resolvePublicOrigin } from "@/lib/auth/public-origin";
import { resolvePublicUser } from "@/lib/auth/profile";
import { createSupabaseAuthRouteHandler } from "@/lib/supabase/route-handler-client";

const bodySchema = z.object({
  name: z.string().min(1, "Name is required.").max(120, "Name is too long."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return validationJsonResponse(parsed.error);
    }

    const { name, email, password } = parsed.data;
    const origin = resolvePublicOrigin(req);
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/app")}`;

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
      const msg = error.message.toLowerCase();
      const dup =
        msg.includes("already") ||
        msg.includes("registered") ||
        msg.includes("exists") ||
        msg.includes("duplicate") ||
        error.status === 422;
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

    // Supabase often returns 200 with no error when the email already exists (identities: []).
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return failJson(409, "This email is already registered. Try signing in instead.");
    }

    if (!data.session) {
      return applyAuthCookies(
        NextResponse.json({
          ok: true,
          needsEmailConfirmation: true,
          message:
            "We've sent you a confirmation email. Open the link to confirm your address — you'll be signed in when it completes.",
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
