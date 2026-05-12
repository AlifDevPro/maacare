import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function peerIdForViewer(
  row: { user_low: string; user_high: string },
  viewerId: string,
): string {
  return row.user_low === viewerId ? row.user_high : row.user_low;
}

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const supabase = await createSupabaseServerClient();
    const uid = session.id;

    const { data: convs, error: cErr } = await supabase
      .from("dm_conversations")
      .select("id, user_low, user_high, updated_at")
      .or(`user_low.eq.${uid},user_high.eq.${uid}`)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (cErr) {
      console.error("[dm/conversations GET]", cErr);
      return failJson(500, "Could not load conversations.");
    }

    const rows = convs ?? [];
    const peerIds = [...new Set(rows.map((r) => peerIdForViewer(r, uid)))];
    const profileById = new Map<string, { display_name: string | null; avatar_url: string | null }>();

    if (peerIds.length > 0) {
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", peerIds);
      if (pErr) {
        console.warn("[dm/conversations GET] profiles", pErr.message);
      } else {
        for (const p of profs ?? []) {
          profileById.set(p.id as string, {
            display_name: (p.display_name as string | null) ?? null,
            avatar_url: (p.avatar_url as string | null) ?? null,
          });
        }
      }
    }

    const { data: reads } = await supabase
      .from("dm_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", uid);

    const readMap = new Map<string, string | null>();
    for (const r of reads ?? []) {
      readMap.set(r.conversation_id as string, (r.last_read_at as string | null) ?? null);
    }

    const items = [];
    for (const c of rows) {
      const peer = peerIdForViewer(c, uid);
      const prof = profileById.get(peer);

      const { data: lastMsg } = await supabase
        .from("dm_messages")
        .select("body, created_at, sender_id")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastRead = readMap.get(c.id as string) ?? null;
      let hasUnread = false;
      if (lastMsg?.sender_id && lastMsg.sender_id !== uid) {
        const created = lastMsg.created_at as string;
        if (!lastRead || new Date(created).getTime() > new Date(lastRead).getTime()) {
          hasUnread = true;
        }
      }

      items.push({
        id: c.id as string,
        updatedAt: c.updated_at as string,
        peerUserId: peer,
        peerDisplayName: prof?.display_name?.trim() || "Member",
        peerAvatarUrl: prof?.avatar_url ?? null,
        lastMessagePreview: typeof lastMsg?.body === "string" ? String(lastMsg.body).slice(0, 140) : "",
        lastMessageAt: (lastMsg?.created_at as string | undefined) ?? null,
        hasUnread,
      });
    }

    return Response.json({ conversations: items });
  } catch (e) {
    return serverErrorJson("dm/conversations GET", e);
  }
}

const postSchema = z.object({
  peerUserId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }
    const parsed = postSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const { data: cid, error } = await supabase.rpc("dm_start_or_get_conversation", {
      p_peer: parsed.data.peerUserId,
    });

    if (error) {
      const msg = error.message || "Could not open conversation.";
      if (/invalid peer|peer not found|not authenticated/i.test(msg)) return failJson(400, msg);
      console.error("[dm/conversations POST]", error);
      return failJson(500, "Could not open conversation.");
    }

    const conversationId = typeof cid === "string" ? cid : null;
    if (!conversationId) return failJson(500, "Could not open conversation.");

    return Response.json({ conversationId });
  } catch (e) {
    return serverErrorJson("dm/conversations POST", e);
  }
}
