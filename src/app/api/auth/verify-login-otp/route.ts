import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  validationJsonResponse,
  failJson,
  serverErrorJson,
} from "@/lib/api/error-response";
import { resolvePublicUser } from "@/lib/auth/profile";
import { createSupabaseAuthRouteHandler } from "@/lib/supabase/route-handler-client";

const bodySchema = z.object({
  email: z.string().email("Enter a valid email address."),
  token: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return validationJsonResponse(parsed.error);
    }

    const { email, token } = parsed.data;
    const { supabase, applyAuthCookies } = createSupabaseAuthRouteHandler(req);

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase().trim(),
      token,
      type: "email",
    });

    if (error || !data.user) {
      console.warn("[auth/verify-login-otp]", error?.message ?? "no user");
      return failJson(401, "That code doesn't match or has expired. Request a new code.");
    }

    const profileUser = await resolvePublicUser(supabase, data.user);
    return applyAuthCookies(NextResponse.json({ user: profileUser }));
  } catch (err) {
    if (err instanceof SyntaxError) {
      return failJson(400, "Request body must be valid JSON.");
    }
    return serverErrorJson("auth/verify-login-otp", err);
  }
}
