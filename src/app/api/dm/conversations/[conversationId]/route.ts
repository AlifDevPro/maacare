import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
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
      .select("id, user_low, user_high, updated_at")
      .eq("id", conversationId.data)
      .maybeSingle();

    if (cErr || !conv) return failJson(404, "Conversation not found.");
    if (conv.user_low !== uid && conv.user_high !== uid) return failJson(404, "Conversation not found.");

    const peerId = conv.user_low === uid ? conv.user_high : conv.user_low;
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", peerId)
      .maybeSingle();

    return Response.json({
      id: conv.id as string,
      updatedAt: conv.updated_at as string,
      peerUserId: peerId as string,
      peerDisplayName: (prof?.display_name as string | null)?.trim() || "Member",
      peerAvatarUrl: (prof?.avatar_url as string | null) ?? null,
    });
  } catch (e) {
    return serverErrorJson("dm/conversation GET", e);
  }
}
