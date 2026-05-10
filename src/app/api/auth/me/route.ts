import { NextResponse } from "next/server";
import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  language: z.enum(["en", "bn"], {
    errorMap: () => ({ message: "Language must be en or bn." }),
  }),
});

export async function PATCH(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return failJson(401, "You are not signed in.");
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return validationJsonResponse(parsed.error);
    }

    const { language } = parsed.data;

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("profiles").update({ language }).eq("id", session.id);

    if (error) {
      return failJson(500, error.message || "Could not update language.");
    }

    return NextResponse.json({
      user: { ...session, language },
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return failJson(400, "Request body must be valid JSON.");
    }
    return serverErrorJson("auth/me", err);
  }
}
