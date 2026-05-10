import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionFromCookies } from "@/lib/auth/get-session";
import { generateChatReply } from "@/lib/gemini/chat";
import { searchKnowledge } from "@/lib/rag/service";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(12_000),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages } = bodySchema.parse(await req.json());

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json({ error: "No user message" }, { status: 400 });
    }

    const hits = await searchKnowledge(lastUser.content, 8);
    const context =
      hits.length > 0
        ? hits
            .map((h, i) => `[${i + 1}] (${h.source ?? "source"}${h.category ? ` · ${h.category}` : ""})\n${h.content}`)
            .join("\n\n---\n\n")
        : "(No matching internal articles were retrieved; answer generally and recommend professional care when unsure.)";

    const transcript = messages
      .slice(-12)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const systemInstruction = [
      "You are MaaCare, a supportive maternity and wellness assistant.",
      "Always remind users that this is informational, not medical diagnosis.",
      "Ground answers in the provided CONTEXT when it is relevant. If CONTEXT is insufficient, say so clearly.",
      "Use clear, compassionate language. Prefer short paragraphs.",
      "",
      "CONTEXT (retrieved articles):",
      context,
    ].join("\n");

    const userMessage = [
      "Conversation so far:",
      transcript,
      "",
      "Reply to the latest user turn helpfully.",
    ].join("\n");

    const reply = await generateChatReply({
      systemInstruction,
      userMessage,
    });

    return NextResponse.json({
      reply,
      citations: hits.map((h) => ({
        id: h.id,
        score: h.score,
        title: h.title,
        source: h.source,
        category: h.category,
        excerpt: h.content.slice(0, 280),
      })),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
