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
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required.").max(200, "Password is too long."),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return validationJsonResponse(parsed.error);
    }

    const { email, password } = parsed.data;

    const { supabase, applyAuthCookies } = createSupabaseAuthRouteHandler(req);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error || !data.user) {
      const unconfirmed =
        error?.code === "email_not_confirmed" ||
        (error?.message?.toLowerCase().includes("confirm") ?? false) ||
        (error?.message?.toLowerCase().includes("not confirmed") ?? false);
      if (unconfirmed) {
        console.warn("[auth/login] email not confirmed:", error?.message);
        return failJson(401, friendlyAuth.confirmEmailFirst);
      }
      console.warn("[auth/login] sign-in rejected:", error?.message ?? "no user");
      return failJson(401, "That email or password doesn't match our records.");
    }

    const profileUser = await resolvePublicUser(supabase, data.user);

    return applyAuthCookies(NextResponse.json({ user: profileUser }));
  } catch (err) {
    if (err instanceof SyntaxError) {
      return failJson(400, "Request body must be valid JSON.");
    }
    return serverErrorJson("auth/login", err);
  }
}
