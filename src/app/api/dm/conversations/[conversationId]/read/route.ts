import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const conversationId = uuid.safeParse((await context.params).conversationId);
    if (!conversationId.success) return failJson(400, "Invalid conversation.");

    const supabase = await createSupabaseServerClient();
    const uid = session.id;

    const { data: conv, error: cErr } = await supabase
      .from("dm_conversations")
      .select("id, user_low, user_high")
      .eq("id", conversationId.data)
      .maybeSingle();

    if (cErr || !conv) return failJson(404, "Conversation not found.");
    if (conv.user_low !== uid && conv.user_high !== uid) return failJson(404, "Conversation not found.");

    const now = new Date().toISOString();
    const { error: uErr } = await supabase
      .from("dm_participants")
      .update({ last_read_at: now })
      .eq("conversation_id", conversationId.data)
      .eq("user_id", uid);

    if (uErr) {
      console.error("[dm/read POST]", uErr);
      return failJson(500, "Could not update read state.");
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("dm/read POST", e);
  }
}
