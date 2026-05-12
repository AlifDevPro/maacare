import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { createSupabaseAuthRouteHandler } from "@/lib/supabase/route-handler-client";

const bodySchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters.").max(200, "Password is too long."),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return validationJsonResponse(parsed.error);
    }

    const { supabase, applyAuthCookies } = createSupabaseAuthRouteHandler(req);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return failJson(401, "Your session expired. Open the reset link from your email again.");
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      console.warn("[auth/update-password]", error.message);
      return failJson(400, error.message || "Could not update password.");
    }

    return applyAuthCookies(NextResponse.json({ ok: true }));
  } catch (err) {
    if (err instanceof SyntaxError) {
      return failJson(400, "Request body must be valid JSON.");
    }
    return serverErrorJson("auth/update-password", err);
  }
}
