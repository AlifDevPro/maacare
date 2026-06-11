import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { dispatchPushNow } from "@/lib/push/dispatch-now";
import { enforceSubscriptionFeature } from "@/lib/subscription/enforce";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

export async function GET(
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

    const { data: msgs, error: mErr } = await supabase
      .from("dm_messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", conversationId.data)
      .order("created_at", { ascending: true })
      .limit(200);

    if (mErr) {
      console.error("[dm/messages GET]", mErr);
      return failJson(500, "Could not load messages.");
    }

    return Response.json({ messages: msgs ?? [] });
  } catch (e) {
    return serverErrorJson("dm/messages GET", e);
  }
}

const postBody = z.object({
  body: z.string().min(1).max(8000),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const dmGate = await enforceSubscriptionFeature(session.id, "doctor_messaging");
    if (!dmGate.ok) return dmGate.response;

    const conversationId = uuid.safeParse((await context.params).conversationId);
    if (!conversationId.success) return failJson(400, "Invalid conversation.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }
    const parsed = postBody.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const uid = session.id;

    const { data: conv, error: cErr } = await supabase
      .from("dm_conversations")
      .select("id, user_low, user_high")
      .eq("id", conversationId.data)
      .maybeSingle();

    if (cErr || !conv) return failJson(404, "Conversation not found.");
    if (conv.user_low !== uid && conv.user_high !== uid) return failJson(404, "Conversation not found.");

    const text = parsed.data.body.trim();
    const { data: inserted, error: insErr } = await supabase
      .from("dm_messages")
      .insert({
        conversation_id: conversationId.data,
        sender_id: uid,
        body: text,
      })
      .select("id, sender_id, body, created_at")
      .single();

    if (insErr || !inserted) {
      console.error("[dm/messages POST]", insErr);
      return failJson(500, "Could not send message.");
    }

    await dispatchPushNow();

    return Response.json({ posted: inserted });
  } catch (e) {
    return serverErrorJson("dm/messages POST", e);
  }
}
