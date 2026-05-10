"use client";

import { useEffect, useRef, useState } from "react";

import { motion } from "framer-motion";
import { Loader2, Mic, Send, Sparkles, Shield } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What should I eat in week 20?",
  "Is mild back pain normal?",
  "How much water should I drink?",
  "What are danger signs to watch for?",
];

const SEED: Msg[] = [
  {
    role: "assistant",
    content:
      "Hi! I'm your **MaaCare AI assistant** 🤍\n\nAsk about pregnancy, symptoms, or planning — answers use your uploaded knowledge base when relevant.",
  },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || sending) return;

    const withUser: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(withUser);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: withUser }),
      });

      const data = (await res.json()) as { reply?: string; error?: string };

      if (res.status === 401) {
        toast.error("Please log in to use the assistant");
        setMessages((m) => m.slice(0, -1));
        return;
      }

      if (!res.ok || !data.reply) {
        throw new Error(data.error ?? "Request failed");
      }

      setMessages((m) => [...m, { role: "assistant", content: data.reply! }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get a reply");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell>
      <AppHeader
        title="AI Assistant"
        showBack
        right={
          sending ? (
            <span className="flex items-center gap-1 px-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Thinking
            </span>
          ) : (
            <span className="px-2 text-xs text-muted-foreground">Gemini + RAG</span>
          )
        }
      />

      <div
        ref={scrollRef}
        className="space-y-3 overflow-y-auto px-4 pt-4 pb-2"
        style={{
          /* Reserve space above fixed composer so the last messages stay visible */
          paddingBottom: "calc(6rem + env(safe-area-inset-bottom))",
        }}
      >
        <div className="mb-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="h-3 w-3" /> AI guidance — not a substitute for medical care
        </div>

        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
          >
            {m.role === "assistant" && (
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-rose text-xs">
                🤍
              </span>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-soft",
                m.role === "user"
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md bg-card",
              )}
            >
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-strong:text-current">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        ))}

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                disabled={sending}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-primary-soft hover:text-primary disabled:opacity-50"
              >
                <Sparkles className="mr-1 inline h-3 w-3" />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="fixed inset-x-0 z-30 mx-auto max-w-md border-t border-border/60 bg-background/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
        style={{
          /* Sit above BottomNav (z-40); do not overlap — nav stays tappable */
          bottom: "calc(env(safe-area-inset-bottom) + 5rem)",
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2 rounded-2xl border border-border bg-card p-1.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            disabled={sending}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 rounded-xl"
            aria-label="Voice input"
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl"
            aria-label="Send"
            disabled={!input.trim() || sending}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
