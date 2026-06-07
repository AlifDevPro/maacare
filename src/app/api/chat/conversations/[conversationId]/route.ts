import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import {
  deleteAiChatConversation,
  loadAiChatConversationDetail,
  updateAiChatConversationTitle,
} from "@/lib/chat/history-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

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
    const detail = await loadAiChatConversationDetail(
      supabase,
      session.id,
      conversationId.data,
    );

    if (!detail) return failJson(404, "Conversation not found.");

    return Response.json({ conversation: detail });
  } catch (e) {
    return serverErrorJson("chat/conversation GET", e);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const conversationId = uuid.safeParse((await context.params).conversationId);
    if (!conversationId.success) return failJson(400, "Invalid conversation.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const updated = await updateAiChatConversationTitle(
      supabase,
      session.id,
      conversationId.data,
      parsed.data.title,
    );

    if (!updated) return failJson(404, "Conversation not found.");

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("chat/conversation PATCH", e);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const conversationId = uuid.safeParse((await context.params).conversationId);
    if (!conversationId.success) return failJson(400, "Invalid conversation.");

    const supabase = await createSupabaseServerClient();
    const deleted = await deleteAiChatConversation(
      supabase,
      session.id,
      conversationId.data,
    );

    if (!deleted) return failJson(404, "Conversation not found.");

    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("chat/conversation DELETE", e);
  }
}
