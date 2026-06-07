import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import {
  createAiChatConversation,
  listAiChatConversations,
} from "@/lib/chat/history-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const supabase = await createSupabaseServerClient();
    const conversations = await listAiChatConversations(supabase, session.id);

    return Response.json({ conversations });
  } catch (e) {
    return serverErrorJson("chat/conversations GET", e);
  }
}

const postSchema = z.object({
  reportContext: z.unknown().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    let json: unknown = {};
    try {
      const text = await req.text();
      if (text.trim()) json = JSON.parse(text);
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = postSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const conversationId = await createAiChatConversation(
      supabase,
      session.id,
      parsed.data.reportContext,
    );

    return Response.json({ conversationId });
  } catch (e) {
    return serverErrorJson("chat/conversations POST", e);
  }
}
