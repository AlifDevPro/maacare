"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  Loader2,
  MapPinned,
  PanelLeft,
  PhoneCall,
  Send,
  Sparkles,
  Shield,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { VoiceCallPanel } from "@/app/chat/voice-call-panel";
import { MaaCareLogoMark } from "@/components/brand/maacare-logo";
import { AppShell } from "@/components/app/AppShell";
import { ChatLayoutShell } from "@/components/chat/chat-layout-shell";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ChatHistoryListItem } from "@/lib/chat/history-ui";
import {
  APP_SHELL_COLUMN_MAX,
  APP_SHELL_COMPOSER_BOTTOM,
  APP_SHELL_CONTENT_PADDING,
  APP_SHELL_CONTENT_WIDTH,
} from "@/lib/app-shell-layout";
import { cn } from "@/lib/utils";
import { speakNatural, stopSpeaking } from "@/lib/voice/speech";
import { useVoiceCall } from "@/lib/voice/useVoiceCall";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What should I eat in week 20?",
  "Is mild back pain normal?",
  "How much water should I drink?",
  "What are danger signs to watch for?",
];

export const CHAT_WELCOME_SEED: Msg[] = [
  {
    role: "assistant",
    content:
      "Hi! I'm your **MaaCare AI assistant** 🤍\n\nAsk about pregnancy, symptoms, or planning — I can help using trusted MaaCare knowledge and your profile context when relevant.",
  },
];

export function ChatPageClient() {
  const { t } = useTranslation("health");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<Msg[]>(CHAT_WELCOME_SEED);
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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationTitle, setActiveConversationTitle] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<ChatHistoryListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatHistoryListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ChatHistoryListItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [chatUserLocation, setChatUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const [locationDialogBusy, setLocationDialogBusy] = useState(false);
  const locationRetryMessagesRef = useRef<Msg[] | null>(null);
  const [locationDialogBody, setLocationDialogBody] = useState<string | null>(null);
  const locationCloseSkipAppendRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastVoiceErrorRef = useRef<string | null>(null);
  const loadedUrlConversationRef = useRef<string | null>(null);

  const sendBlocked = sending || cooldownSeconds > 0 || loadingConversation;
  const reportContextFromUrl = searchParams.get("reportContext");
  const [reportContextOverride, setReportContextOverride] = useState<string | null>(null);
  const effectiveReportContext = reportContextOverride ?? reportContextFromUrl;
  const reportContextTitle = (() => {
    if (!effectiveReportContext) return null;
    try {
      const parsed = JSON.parse(effectiveReportContext) as { title?: string };
      return parsed.title?.trim() || "report";
    } catch {
      return "report";
    }
  })();

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/chat/conversations", { credentials: "include" });
      if (res.status === 401) {
        setConversations([]);
        return;
      }
      if (!res.ok) throw new Error(t("chat_history_load_error"));
      const data = (await res.json()) as { conversations?: ChatHistoryListItem[] };
      setConversations(data.conversations ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("chat_history_load_error"));
    } finally {
      setHistoryLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const setConversationInUrl = useCallback(
    (id: string | null) => {
      const base = pathname || "/chat";
      if (id) router.replace(`${base}?c=${id}`);
      else router.replace(base);
    },
    [pathname, router],
  );

  const startNewChat = useCallback(() => {
    setActiveConversationId(null);
    setActiveConversationTitle(null);
    setMessages(CHAT_WELCOME_SEED);
    setInput("");
    setReportContextOverride(null);
    loadedUrlConversationRef.current = null;
    setConversationInUrl(null);
    setSidebarOpen(false);
  }, [setConversationInUrl]);

  const loadConversation = useCallback(
    async (id: string) => {
      setLoadingConversation(true);
      try {
        const res = await fetch(`/api/chat/conversations/${id}`, { credentials: "include" });
        if (res.status === 401) {
          toast.error(t("chat_history_sign_in"));
          return;
        }
        if (!res.ok) throw new Error(t("chat_resume_error"));

        const data = (await res.json()) as {
          conversation?: {
            id: string;
            title: string;
            messages: Array<{ role: "user" | "assistant"; content: string }>;
            reportContext?: unknown;
          };
        };

        const conv = data.conversation;
        if (!conv) throw new Error(t("chat_resume_error"));

        setActiveConversationId(conv.id);
        setActiveConversationTitle(conv.title);
        loadedUrlConversationRef.current = conv.id;
        setMessages(
          conv.messages.length > 0
            ? conv.messages.map((m) => ({ role: m.role, content: m.content }))
            : CHAT_WELCOME_SEED,
        );

        if (conv.reportContext != null) {
          try {
            setReportContextOverride(JSON.stringify(conv.reportContext));
          } catch {
            setReportContextOverride(null);
          }
        } else {
          setReportContextOverride(null);
        }

        setConversationInUrl(conv.id);
        setSidebarOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("chat_resume_error"));
        startNewChat();
      } finally {
        setLoadingConversation(false);
      }
    },
    [setConversationInUrl, startNewChat, t],
  );

  useEffect(() => {
    const urlId = searchParams.get("c");
    if (!urlId) {
      loadedUrlConversationRef.current = null;
      return;
    }
    if (loadedUrlConversationRef.current === urlId) return;
    void loadConversation(urlId);
  }, [searchParams, loadConversation]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!voiceMode) stopSpeaking();
  }, [voiceMode]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          setRateLimitMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  function applyConversationId(id: string) {
    setActiveConversationId(id);
    loadedUrlConversationRef.current = id;
    setConversationInUrl(id);
    void loadHistory();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/chat/conversations/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(t("chat_delete_error"));
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      if (activeConversationId === deleteTarget.id) startNewChat();
      toast.success(t("chat_delete_success"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("chat_delete_error"));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function confirmRename() {
    if (!renameTarget) return;
    const title = renameValue.trim();
    if (!title) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/chat/conversations/${renameTarget.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(t("chat_rename_error"));
      setConversations((prev) =>
        prev.map((c) => (c.id === renameTarget.id ? { ...c, title } : c)),
      );
      if (activeConversationId === renameTarget.id) setActiveConversationTitle(title);
      toast.success(t("chat_rename_done"));
      setRenameTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("chat_rename_error"));
    } finally {
      setRenaming(false);
    }
  }

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
              reportContext: effectiveReportContext ?? undefined,
              userLocation: coords,
              conversationId: activeConversationId ?? undefined,
            }),
          });
          const data = (await res.json()) as {
            reply?: string;
            error?: string;
            retryAfterSeconds?: number;
            provider?: "gemini" | "groq";
            conversationId?: string;
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
          if (data.conversationId) applyConversationId(data.conversationId);
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

  async function send(
    text: string,
    opts?: { replyChannel?: "text" | "voice" },
  ): Promise<string | null> {
    const trimmed = text.trim();
    if (!trimmed || sendBlocked) return null;

    const withUser: Msg[] = [...messages, { role: "user", content: trimmed }];
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
          reportContext: effectiveReportContext ?? undefined,
          userLocation: chatUserLocation ?? undefined,
          replyChannel: opts?.replyChannel ?? "text",
          conversationId: activeConversationId ?? undefined,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        retryAfterSeconds?: number;
        provider?: "gemini" | "groq";
        needsClientLocation?: boolean;
        conversationId?: string;
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
      if (data.conversationId) {
        applyConversationId(data.conversationId);
        if (!activeConversationTitle) {
          setActiveConversationTitle(trimmed.slice(0, 80));
        }
      }

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
    onTurn: async (finalText) => send(finalText, { replyChannel: "voice" }),
    onSpeak: async (assistantText) => {
      await speakNatural({
        text: assistantText,
        lang: "en-US",
        rate: 0.96,
        pitch: 1,
        volume: 1,
        pauseBetweenMs: 150,
      });
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
          await speakNatural({
            text: "Hi, I'm MaaCare AI. What topic would you like to talk about today?",
            lang: "en-US",
            rate: 0.96,
            pitch: 1,
            volume: 1,
            pauseBetweenMs: 120,
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
      window.requestAnimationFrame(() => {
        setVoiceMicMuted(true);
        toast.error("Microphone permission denied. Enable mic access in browser settings.");
      });
      return;
    }
    if (err.includes("audio-capture") || err.includes("not-found")) {
      window.requestAnimationFrame(() => {
        setVoiceMicMuted(true);
        toast.error("No microphone found. Connect a mic and try again.");
      });
      return;
    }
    toast.error(voiceLastError);
  }, [voiceMode, voiceLastError]);

  const headerTitle = activeConversationTitle?.trim() || t("chat_ai_title");

  const sidebar = (
    <ChatSidebar
      items={conversations}
      loading={historyLoading}
      activeConversationId={activeConversationId}
      onNewChat={startNewChat}
      onSelectConversation={(id) => void loadConversation(id)}
      onDeleteConversation={setDeleteTarget}
      onRenameConversation={(item) => {
        setRenameTarget(item);
        setRenameValue(item.title);
      }}
    />
  );

  return (
    <>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chat_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("chat_delete_confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("chat_delete_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("chat_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(renameTarget)} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="gap-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("chat_rename_title")}</DialogTitle>
            <DialogDescription className="sr-only">{t("chat_rename_title")}</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={120}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
              {t("chat_delete_cancel")}
            </Button>
            <Button
              type="button"
              disabled={!renameValue.trim() || renaming}
              onClick={() => void confirmRename()}
            >
              {renaming ? <Loader2 className="h-4 w-4 animate-spin" /> : t("chat_rename_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <AppShell wide className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatLayoutShell
          sidebar={sidebar}
          mobileSidebarOpen={sidebarOpen}
          onMobileSidebarOpenChange={setSidebarOpen}
          sidebarTitle={t("chat_history_title")}
        >
          <header className="shrink-0 border-b border-border/60 bg-background/90 backdrop-blur-xl">
            <div
              className={cn(
                "mx-auto flex h-12 w-full items-center gap-2",
                APP_SHELL_COLUMN_MAX,
                APP_SHELL_CONTENT_PADDING,
              )}
            >
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                aria-label={t("chat_open_sidebar")}
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" asChild>
                <Link href="/app" aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{headerTitle}</h1>
              <div className="flex shrink-0 items-center gap-1">
                {sending || loadingConversation ? (
                  <span className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Thinking
                  </span>
                ) : cooldownSeconds > 0 ? (
                  <span className="px-1 text-xs text-muted-foreground">Retry in {cooldownSeconds}s</span>
                ) : (
                  <span className="px-1 text-muted-foreground" title={providerLabel === "groq" ? "Groq" : "Gemini"}>
                    {providerLabel === "groq" ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </span>
                )}
              </div>
            </div>
          </header>

          <div
            className={cn(
              "mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden",
              APP_SHELL_COLUMN_MAX,
              APP_SHELL_CONTENT_PADDING,
            )}
          >
            <div
              ref={scrollRef}
              className={cn(
                "min-h-0 flex-1 overflow-y-auto py-4",
                !voiceMode && "pb-[calc(7rem+env(safe-area-inset-bottom))]",
                voiceMode && !showVoiceTranscript && "hidden",
              )}
            >
            <div className="w-full space-y-4">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <Shield className="h-3 w-3" /> AI guidance — not a substitute for medical care
              </div>
              {reportContextTitle ? (
                <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-primary">
                  Report context loaded ({reportContextTitle}). Ask follow-up questions about this report.
                </div>
              ) : null}

              {loadingConversation ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                messages.map((m, i) => (
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
                      <MaaCareLogoMark size={32} className="mt-1.5 h-8 w-8" />
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
                ))
              )}

              {sending ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex w-full min-w-0 items-start justify-start gap-2.5"
                >
                  <MaaCareLogoMark size={32} className="mt-1.5 h-8 w-8" />
                  <div className="min-w-0 flex-1 rounded-2xl rounded-bl-md rounded-tr-xl border border-border/60 bg-card px-4 py-3.5 text-sm shadow-card">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      MaaCare AI is writing...
                    </span>
                  </div>
                </motion.div>
              ) : null}

              {!loadingConversation && messages.length <= 1 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      disabled={sendBlocked}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-primary-soft hover:text-primary disabled:opacity-50"
                    >
                      <Sparkles className="mr-1 inline h-3 w-3" />
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>

          {voiceMode ? (
            <>
              <VoiceCallPanel
                state={voice.state}
                partial={voice.partial}
                muted={voiceMuted}
                micMuted={voiceMicMuted}
                introPending={voiceIntroPending}
                onToggleMuted={() => setVoiceMuted((v) => !v)}
                onToggleMicMuted={() => setVoiceMicMuted((m) => !m)}
                onStartCall={() => setVoiceMicMuted(false)}
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
                <div className="border-t border-amber-300/50 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                  Voice is not available on this browser (common on iPhone Safari). Text chat still works.
                </div>
              ) : null}
            </>
          ) : null}

          {!voiceMode ? (
            <div
              className={cn(
                "fixed inset-x-0 z-30 border-t border-border/60 bg-background/95 pt-2 pb-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/85",
                APP_SHELL_COMPOSER_BOTTOM,
                APP_SHELL_CONTENT_WIDTH,
              )}
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
                    sending || loadingConversation
                      ? "MaaCare AI is generating a reply..."
                      : cooldownSeconds > 0
                        ? `Please wait ${cooldownSeconds}s before sending again...`
                        : "Ask anything…"
                  }
                  className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                  disabled={sending || loadingConversation}
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
        </ChatLayoutShell>
      </AppShell>
    </>
  );
}
