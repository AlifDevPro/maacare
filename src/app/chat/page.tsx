"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { motion } from "framer-motion";
import { Bot, Loader2, MapPinned, Mic, Send, Sparkles, Shield, PhoneCall } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { VoiceCallPanel } from "@/app/chat/voice-call-panel";
import { speakText, stopSpeaking } from "@/lib/voice/speech";
import { useVoiceCall } from "@/lib/voice/useVoiceCall";

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
      "Hi! I'm your **MaaCare AI assistant** 🤍\n\nAsk about pregnancy, symptoms, or planning — I can help using trusted MaaCare knowledge and your profile context when relevant.",
  },
];

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatPageLoading />}>
      <ChatPageContent />
    </Suspense>
  );
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceMicMuted, setVoiceMicMuted] = useState(false);
  const [voiceIntroPending, setVoiceIntroPending] = useState(false);
  const [showVoiceTranscript, setShowVoiceTranscript] = useState(false);
  const [providerLabel, setProviderLabel] = useState<"gemini" | "groq" | null>("gemini");
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  /** Remembered after a successful in-dialog share; sent with later /api/chat calls. */
  const [chatUserLocation, setChatUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const [locationDialogBusy, setLocationDialogBusy] = useState(false);
  /** Messages to POST on auto-retry (includes user turn; excludes interim assistant). */
  const locationRetryMessagesRef = useRef<Msg[] | null>(null);
  /** AI one-liner shown only inside the location dialog (not duplicated in the thread). */
  const [locationDialogBody, setLocationDialogBody] = useState<string | null>(null);
  /** When true, closing the location dialog must not append the short reply into chat. */
  const locationCloseSkipAppendRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastVoiceErrorRef = useRef<string | null>(null);
  const sendBlocked = sending || cooldownSeconds > 0;
  const reportContextRaw = searchParams.get("reportContext");
  const reportContextTitle = (() => {
    if (!reportContextRaw) return null;
    try {
      const parsed = JSON.parse(reportContextRaw) as { title?: string };
      return parsed.title?.trim() || "report";
    } catch {
      return "report";
    }
  })();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!voiceMode) stopSpeaking();
  }, [voiceMode]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = window.setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          setRateLimitMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [cooldownSeconds]);

  async function grantLocationAndContinueChat() {
    const msgs = locationRetryMessagesRef.current;
    if (!msgs) {
      setLocationPromptOpen(false);
      return;
    }
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported on this device.");
      return;
    }

    setLocationDialogBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setSending(true);
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: msgs,
              reportContext: reportContextRaw ?? undefined,
              userLocation: coords,
            }),
          });
          const data = (await res.json()) as {
            reply?: string;
            error?: string;
            retryAfterSeconds?: number;
            provider?: "gemini" | "groq";
          };

          if (res.status === 401) {
            toast.error("Please log in to use the assistant");
            return;
          }
          if (res.status === 429) {
            const retry = Math.max(1, Number(data.retryAfterSeconds ?? 60) || 60);
            setCooldownSeconds(retry);
            setRateLimitMessage(
              data.error ?? "AI usage limit reached. Please wait a moment before sending again.",
            );
            return;
          }
          if (!res.ok || !data.reply) {
            throw new Error(data.error ?? "Request failed");
          }
          const replyBody: string = data.reply;

          setRateLimitMessage(null);
          if (data.provider) setProviderLabel(data.provider);
          setChatUserLocation(coords);
          locationCloseSkipAppendRef.current = true;
          setLocationDialogBody(null);
          setMessages([...msgs, { role: "assistant", content: replyBody }]);
          locationRetryMessagesRef.current = null;
          setLocationPromptOpen(false);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not get a reply");
        } finally {
          setSending(false);
          setLocationDialogBusy(false);
        }
      },
      () => {
        setLocationDialogBusy(false);
        toast.error("Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  async function send(text: string): Promise<string | null> {
    const t = text.trim();
    if (!t || sendBlocked) return null;

    const withUser: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(withUser);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: withUser,
          reportContext: reportContextRaw ?? undefined,
          userLocation: chatUserLocation ?? undefined,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        retryAfterSeconds?: number;
        provider?: "gemini" | "groq";
        needsClientLocation?: boolean;
      };

      if (res.status === 401) {
        toast.error("Please log in to use the assistant");
        setMessages((m) => m.slice(0, -1));
        return null;
      }

      if (res.status === 429) {
        const retry = Math.max(1, Number(data.retryAfterSeconds ?? 60) || 60);
        setCooldownSeconds(retry);
        setRateLimitMessage(
          data.error ?? "AI usage limit reached. Please wait a moment before sending again.",
        );
        return null;
      }

      if (!res.ok || !data.reply) {
        throw new Error(data.error ?? "Request failed");
      }
      const replyBody: string = data.reply;

      setRateLimitMessage(null);
      if (data.provider) setProviderLabel(data.provider);

      if (data.needsClientLocation) {
        locationRetryMessagesRef.current = withUser;
        locationCloseSkipAppendRef.current = false;
        setLocationDialogBody(replyBody);
        setMessages(withUser);
        setLocationPromptOpen(true);
        return null;
      }

      setMessages((m) => [...m, { role: "assistant", content: replyBody }]);
      return replyBody;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get a reply");
      setMessages((m) => m.slice(0, -1));
      return null;
    } finally {
      setSending(false);
    }
  }

  const voice = useVoiceCall({
    lang: "en-US",
    enabled: voiceMode && !voiceIntroPending && !voiceMicMuted && cooldownSeconds <= 0 && !sending,
    muted: voiceMuted,
    autoRestart: true,
    onUnsupported: () => {
      toast.error("Voice call is not supported on this browser. Please use text chat.");
    },
    onTurn: async (finalText) => send(finalText),
    onSpeak: async (assistantText) => {
      await speakText({ text: assistantText, lang: "en-US", rate: 1, pitch: 1, volume: 1 });
    },
  });
  const voiceStart = voice.start;
  const voiceState = voice.state;
  const voiceSupported = voice.supported;
  const voiceLastError = voice.lastError;

  useEffect(() => {
    if (!voiceMode || !voiceIntroPending) return;
    let cancelled = false;

    void (async () => {
      try {
        if (!voiceMuted) {
          await speakText({
            text: "Hi, I'm MaaCare AI. What topic would you like to talk about today?",
            lang: "en-US",
            rate: 1,
            pitch: 1,
            volume: 1,
          });
        }
      } catch {
        // If TTS fails, still proceed to listening.
      } finally {
        if (!cancelled) setVoiceIntroPending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [voiceMode, voiceIntroPending, voiceMuted]);

  useEffect(() => {
    // Start mic only after state updates are applied, otherwise start() can run with enabled=false.
    const canStart = voiceMode && !voiceMicMuted && cooldownSeconds <= 0 && !sending && voiceSupported;
    if (!canStart) return;
    if (voiceState !== "idle" && voiceState !== "error") return;
    voiceStart();
  }, [voiceMode, voiceMicMuted, cooldownSeconds, sending, voiceSupported, voiceState, voiceStart]);

  useEffect(() => {
    if (!voiceMode) {
      lastVoiceErrorRef.current = null;
      return;
    }
    if (!voiceLastError) return;
    if (lastVoiceErrorRef.current === voiceLastError) return;
    lastVoiceErrorRef.current = voiceLastError;

    const err = voiceLastError.toLowerCase();
    if (
      err.includes("not-allowed") ||
      err.includes("permission") ||
      err.includes("service-not-allowed")
    ) {
      setVoiceMicMuted(true);
      toast.error("Microphone permission denied. Enable mic access in browser settings.");
      return;
    }
    if (err.includes("audio-capture") || err.includes("not-found")) {
      setVoiceMicMuted(true);
      toast.error("No microphone found. Connect a mic and try again.");
      return;
    }
    toast.error(voiceLastError);
  }, [voiceMode, voiceLastError]);

  return (
    <>
      <Dialog
        open={locationPromptOpen}
        onOpenChange={(open) => {
          if (!open) {
            const skip = locationCloseSkipAppendRef.current;
            locationCloseSkipAppendRef.current = false;
            const pending = locationDialogBody;
            if (!skip && pending && locationRetryMessagesRef.current) {
              setMessages((msgs) => {
                const last = msgs[msgs.length - 1];
                if (last?.role === "user") return [...msgs, { role: "assistant", content: pending }];
                return msgs;
              });
            }
            setLocationDialogBody(null);
            locationRetryMessagesRef.current = null;
          }
          setLocationPromptOpen(open);
        }}
      >
        <DialogContent className="gap-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPinned className="h-5 w-5 text-primary" />
              Location needed
            </DialogTitle>
            <DialogDescription asChild className="text-left">
              <div className="space-y-3 pt-1">
                {locationDialogBody ? (
                  <div className="chat-assistant-md rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                    <ReactMarkdown>{locationDialogBody}</ReactMarkdown>
                  </div>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Allow location once to finish this answer in the chat below. You do not need to send another message.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          {locationDialogBusy ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-center text-sm text-muted-foreground">Getting location and finishing your reply…</p>
            </div>
          ) : (
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setLocationPromptOpen(false)}>
                Not now
              </Button>
              <Button type="button" className="rounded-xl" onClick={() => void grantLocationAndContinueChat()}>
                Share location
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AppShell>
        <AppHeader
          title="AI Assistant"
          showBack
          right={
            sending ? (
              <span className="flex items-center gap-1 px-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking
              </span>
            ) : cooldownSeconds > 0 ? (
              <span className="px-2 text-xs text-muted-foreground">Retry in {cooldownSeconds}s</span>
            ) : (
              <span className="px-2 text-muted-foreground" title={providerLabel === "groq" ? "Groq" : "Gemini"}>
                {providerLabel === "groq" ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </span>
            )
          }
        />

      <div
        ref={scrollRef}
        className={cn(
          "space-y-4 overflow-y-auto px-4 pt-4 pb-2",
          voiceMode && !showVoiceTranscript && "hidden",
        )}
        style={{
          /* Reserve space above fixed composer so the last messages stay visible */
          paddingBottom: "calc(6rem + env(safe-area-inset-bottom))",
        }}
      >
        <div className="mb-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="h-3 w-3" /> AI guidance — not a substitute for medical care
        </div>
        {reportContextTitle ? (
          <div className="mb-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-primary">
            Report context loaded ({reportContextTitle}). Ask follow-up questions about this report.
          </div>
        ) : null}

        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex w-full min-w-0 gap-2.5",
              m.role === "user" ? "justify-end" : "items-start justify-start",
            )}
          >
            {m.role === "assistant" ? (
              <span className="mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-rose text-sm shadow-soft">
                🤍
              </span>
            ) : null}
            <div
              className={cn(
                "min-w-0 text-pretty shadow-soft",
                m.role === "user"
                  ? "max-w-[min(92%,26rem)] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                  : "flex-1 rounded-2xl rounded-bl-md rounded-tr-xl border border-border/60 bg-card px-4 py-3.5 text-sm text-foreground shadow-card",
              )}
            >
              <div className={m.role === "user" ? "chat-user-md" : "chat-assistant-md"}>
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        ))}

        {sending ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full min-w-0 items-start justify-start gap-2.5"
          >
            <span className="mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-rose text-sm shadow-soft">
              🤍
            </span>
            <div className="min-w-0 flex-1 rounded-2xl rounded-bl-md rounded-tr-xl border border-border/60 bg-card px-4 py-3.5 text-sm shadow-card">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                MaaCare AI is writing...
              </span>
            </div>
          </motion.div>
        ) : null}

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

      {/* Voice call overlay */}
      {voiceMode ? (
        <>
          <VoiceCallPanel
            state={voice.state}
            partial={voice.partial}
            muted={voiceMuted}
            micMuted={voiceMicMuted}
            onToggleMuted={() => setVoiceMuted((v) => !v)}
            onToggleMicMuted={() => {
              setVoiceMicMuted((m) => !m);
            }}
            onStartCall={() => {
              setVoiceMicMuted(false);
            }}
            onEnd={() => {
              voice.stop();
              setVoiceMode(false);
              setVoiceIntroPending(false);
            }}
            showTranscript={showVoiceTranscript}
            onToggleTranscript={() => setShowVoiceTranscript((s) => !s)}
            disabled={!voice.supported}
          />
          {!voice.supported ? (
            <div className="fixed inset-x-0 top-16 z-[60] mx-auto max-w-md px-4">
              <div className="rounded-2xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-xs text-amber-800 shadow-soft dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                Voice is not available on this browser (common on iPhone Safari). Text chat still works.
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Text composer (hidden during call mode) */}
      {!voiceMode ? (
        <div
          className="fixed inset-x-0 z-30 mx-auto max-w-md border-t border-border/60 bg-background/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
          style={{
            /* Sit above BottomNav (z-40); do not overlap — nav stays tappable */
            bottom: "calc(env(safe-area-inset-bottom) + 5rem)",
          }}
        >
          {cooldownSeconds > 0 ? (
            <div className="mb-2 rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
              {rateLimitMessage ?? "AI usage limit reached."} Try again in {cooldownSeconds}s.
            </div>
          ) : null}
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
              placeholder={
                sending
                  ? "MaaCare AI is generating a reply..."
                  : cooldownSeconds > 0
                    ? `Please wait ${cooldownSeconds}s before sending again...`
                    : "Ask anything…"
              }
              className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
              disabled={sending}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0 rounded-xl"
              aria-label="Voice call"
              onClick={() => {
                if (!voice.supported) {
                  toast.error("Voice call is not supported on this browser. Please use text chat.");
                  return;
                }
                setShowVoiceTranscript(false);
                setVoiceMicMuted(false);
                setVoiceIntroPending(true);
                setVoiceMode(true);
              }}
            >
              <PhoneCall className="h-4 w-4" />
            </Button>
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl"
              aria-label="Send"
              disabled={!input.trim() || sendBlocked}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      ) : null}
      </AppShell>
    </>
  );
}

function ChatPageLoading() {
  return (
    <AppShell>
      <AppHeader title="AI Assistant" showBack />
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  );
}
