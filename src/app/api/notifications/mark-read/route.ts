import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z
  .object({
    all: z.boolean().optional(),
    ids: z.array(z.string().uuid()).max(100).optional(),
  })
  .refine((b) => b.all === true || (Array.isArray(b.ids) && b.ids.length > 0), {
    message: "Send all: true or a non-empty ids array.",
  });

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to update notifications.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const uid = session.id;
    const now = new Date().toISOString();

    if (parsed.data.all) {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("user_id", uid)
        .is("read_at", null);

      if (error) {
        console.error("notifications mark all read", error);
        return failJson(500, "Could not update notifications.");
      }
      return Response.json({ ok: true });
    }

    const ids = parsed.data.ids!;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", uid)
      .in("id", ids);

    if (error) {
      console.error("notifications mark read", error);
      return failJson(500, "Could not update notifications.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("notifications/mark-read POST", e);
  }
}
