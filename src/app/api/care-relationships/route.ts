import { NextResponse } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const postSchema = z.object({
  mode: z.enum(["subject_invites_viewer", "viewer_requests_subject"]),
  otherUserId: z.string().uuid(),
});

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in required.");

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("care_relationships")
      .select(
        "id, subject_user_id, viewer_user_id, invited_by_user_id, status, permissions, invited_at, accepted_at, revoked_at",
      )
      .or(`subject_user_id.eq.${session.id},viewer_user_id.eq.${session.id}`)
      .order("invited_at", { ascending: false });

    if (error) return failJson(500, "Could not load care links.");
    return NextResponse.json({ relationships: data ?? [] });
  } catch (err) {
    return serverErrorJson("care-relationships/get", err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in required.");

    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const self = session.id;
    const { mode, otherUserId } = parsed.data;
    if (otherUserId === self) return failJson(400, "Choose another member.");

    const subject_user_id = mode === "subject_invites_viewer" ? self : otherUserId;
    const viewer_user_id = mode === "subject_invites_viewer" ? otherUserId : self;
    const invited_by_user_id = self;

    const row = {
      subject_user_id,
      viewer_user_id,
      invited_by_user_id,
      status: "pending" as const,
      permissions: { read_pregnancy: true, read_vitals: true, read_symptoms: true },
    };

    const { data, error } = await supabase.from("care_relationships").insert(row).select("id").maybeSingle();

    if (error) {
      if (error.code === "23505") return failJson(409, "An invite already exists for this pair.");
      return failJson(500, "Could not create invite.");
    }
    return NextResponse.json({ ok: true, id: data?.id ?? null });
  } catch (err) {
    if (err instanceof SyntaxError) return failJson(400, "Invalid JSON.");
    return serverErrorJson("care-relationships/post", err);
  }
}
