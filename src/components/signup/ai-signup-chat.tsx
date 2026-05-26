"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Eye, EyeOff, Loader2, Mail, Lock, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AuthInlineAlert,
  AuthMailSuccessState,
  AuthSubmittingState,
} from "@/components/auth/auth-inline-feedback";
import type { SignupWizardNav } from "@/components/signup/signup-wizard-nav";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkEmailRegistered, registerAccount } from "@/lib/auth-client";
import { buildSignupProfilePayload } from "@/lib/signup/build-profile-payload";
import {
  collectRecentUserBodiesBeforeLatest,
  normalizeSignupDraftFromUserText,
} from "@/lib/signup/draft-normalize";
import {
  deriveOnboardingFocus,
  fallbackQuestionForOnboardingFocus,
} from "@/lib/signup/onboarding-focus";
import { emptyAiSignupProfileDraft, type SignupProfileDraft } from "@/lib/signup/signup-draft";
import {
  signupDraftReadyForCredentials,
  validateAccountCredentials,
  validateTermsAccepted,
} from "@/lib/signup/validators";
import { FORM_FOCUS_SAFE } from "@/lib/form-control-focus";
import { isValidEmailFormat } from "@/lib/validation/email";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SEED: Msg[] = [
  {
    role: "assistant",
    content:
      "Hi, I’ll help you set up MaaCare with a quick chat.\n\n**How should we call you?**\n\n(Your **email** and **password** are entered only on the secure step below — never paste them here.)",
  },
];

const fieldBase = "rounded-sm shadow-none focus-visible:ring-1 h-10 w-full min-w-0";

export const AI_SIGNUP_FORM_ID = "ai-signup-form";

type AiSignupChatProps = {
  onNavChange: (nav: SignupWizardNav | null) => void;
  onCompleteChange?: (complete: boolean) => void;
};

export function AiSignupChat({ onNavChange, onCompleteChange }: AiSignupChatProps) {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [draft, setDraft] = useState<SignupProfileDraft>(() => emptyAiSignupProfileDraft());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [terms, setTerms] = useState(false);
  const [emailRegistered, setEmailRegistered] = useState<boolean | null>(null);
  const [emailLookupPending, setEmailLookupPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  const effectiveDraft = useMemo(() => {
    const lastUser = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
    return normalizeSignupDraftFromUserText(draft, lastUser, {
      recentUserTexts: collectRecentUserBodiesBeforeLatest(messages, 4),
    });
  }, [draft, messages]);

  const ready = signupDraftReadyForCredentials(effectiveDraft);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    const trimmed = email.trim();
    if (!isValidEmailFormat(trimmed)) {
      queueMicrotask(() => {
        setEmailRegistered(null);
        setEmailLookupPending(false);
      });
      return;
    }
    queueMicrotask(() => {
      setEmailLookupPending(true);
      setEmailRegistered(null);
    });
    const id = setTimeout(() => {
      void checkEmailRegistered(trimmed).then((r) => {
        if (cancelled) return;
        setEmailLookupPending(false);
        if (r.ok && "unavailable" in r && r.unavailable) {
          setEmailRegistered(null);
        } else if (r.ok && "registered" in r) {
          setEmailRegistered(r.registered);
        } else {
          setEmailRegistered(null);
        }
      });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [email]);

  const sendUser = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const nextMsgs: Msg[] = [...messages, { role: "user", content: text }];
    const outboundDraft = normalizeSignupDraftFromUserText(draft, text, {
      recentUserTexts: collectRecentUserBodiesBeforeLatest(nextMsgs, 4),
    });
    setInput("");
    setMessages(nextMsgs);
    setSending(true);
    try {
      const res = await fetch("/api/signup/ai-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMsgs, draft: outboundDraft }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        reply?: string;
        draft?: SignupProfileDraft;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        const fallback =
          res.status === 429
            ? "Too many requests. Wait a moment and try again."
            : res.status === 503
              ? "AI is temporarily unavailable. Try manual signup or retry shortly."
              : "Could not reach the assistant. Try again.";
        setFormError(j.message ?? fallback);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Something went wrong on our side. You can **try again** in a moment, or switch to **Manual** registration above.",
          },
        ]);
        return;
      }
      const reply = typeof j.reply === "string" ? j.reply.trim() : "";
      const resolvedDraft =
        j.draft ??
        normalizeSignupDraftFromUserText(outboundDraft, text, {
          recentUserTexts: collectRecentUserBodiesBeforeLatest(nextMsgs, 4),
        });
      if (j.draft) {
        setDraft(
          normalizeSignupDraftFromUserText(j.draft, text, {
            recentUserTexts: collectRecentUserBodiesBeforeLatest(nextMsgs, 4),
          }),
        );
      } else {
        setDraft(resolvedDraft);
      }
      const { nextFocus } = deriveOnboardingFocus(resolvedDraft);
      const fallbackQuestion = fallbackQuestionForOnboardingFocus(nextFocus, resolvedDraft);
      let assistantReply = reply;
      if (!assistantReply) {
        assistantReply = fallbackQuestion;
      } else if (nextFocus !== "ready_for_secure_step" && !assistantReply.includes("?")) {
        assistantReply = `${assistantReply}\n\n${fallbackQuestion}`;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: assistantReply }]);
    } catch {
      setFormError("Network error. Try again.");
    } finally {
      setSending(false);
    }
  }, [draft, input, messages, sending]);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    const name = effectiveDraft.displayName.trim();
    const accErr = validateAccountCredentials({ name, email, password });
    setFormError(null);
    if (accErr) {
      setFormError(accErr);
      return;
    }
    const termsErr = validateTermsAccepted(terms);
    if (termsErr) {
      setFormError(termsErr);
      return;
    }

    const dupCheck = await checkEmailRegistered(email.trim());
    if (dupCheck.ok && !("unavailable" in dupCheck) && dupCheck.registered) {
      setFormError("This email is already registered. Try signing in instead.");
      setEmailRegistered(true);
      return;
    }

    setSaving(true);
    try {
      const result = await registerAccount(name, email, password);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      const lastUserLine =
        [...messages].reverse().find((m) => m.role === "user")?.content?.trim() ?? "";

      const profileDraft = normalizeSignupDraftFromUserText(effectiveDraft, lastUserLine, {
        recentUserTexts: collectRecentUserBodiesBeforeLatest(messages, 4),
      });
      const profilePayload = buildSignupProfilePayload(profileDraft);

      if ("needsEmailConfirmation" in result && result.needsEmailConfirmation) {
        setEmailConfirmSent(true);
        return;
      }

      try {
        const patchRes = await fetch("/api/profile", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profilePayload),
        });
        if (!patchRes.ok) {
          const j = (await patchRes.json().catch(() => ({}))) as { message?: string };
          setFormError(
            j.message ?? "Account created but profile details could not be saved. Update them in Profile.",
          );
        }
      } catch {
        setFormError("Account created but profile sync failed. You can update details in Profile.");
      }

      await router.refresh();
      router.push("/app");
    } finally {
      setSaving(false);
    }
  }

  const credentialsReady =
    ready &&
    isValidEmailFormat(email.trim()) &&
    !(emailRegistered === true && !emailLookupPending) &&
    password.length >= 8 &&
    terms;

  useEffect(() => {
    onCompleteChange?.(emailConfirmSent);
  }, [emailConfirmSent, onCompleteChange]);

  useEffect(() => {
    if (emailConfirmSent || saving) {
      onNavChange(null);
      return;
    }
    if (!ready) {
      onNavChange(null);
      return;
    }
    onNavChange({
      isFirstStep: false,
      onBackStep: () => {},
      primaryLabel: t("signup_wizard_create"),
      onPrimary: () => {},
      primaryDisabled: !credentialsReady,
      isSubmit: true,
      formId: AI_SIGNUP_FORM_ID,
    });
  }, [credentialsReady, emailConfirmSent, onNavChange, ready, saving]);

  if (emailConfirmSent) {
    return (
      <AuthMailSuccessState
        title={t("signup_email_confirm_title")}
        body={t("signup_email_confirm_body")}
        email={email.trim()}
      />
    );
  }

  if (saving) {
    return <AuthSubmittingState label="Creating account…" />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {formError ? <AuthInlineAlert message={formError} /> : null}
      <div
        ref={scrollRef}
        className="flex max-h-[min(52vh,420px)] min-h-[200px] flex-col gap-3 overflow-y-auto rounded-lg bg-muted/15 px-2 py-3 sm:px-3"
      >
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}-${m.content.slice(0, 24)}`}
            className={cn(
              "max-w-[min(92%,28rem)] text-sm leading-relaxed",
              m.role === "user"
                ? "ml-auto rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-primary-foreground shadow-sm"
                : "mr-auto rounded-2xl rounded-bl-md border border-border/70 bg-card px-3.5 py-2.5 text-foreground shadow-sm",
            )}
          >
            {m.role === "assistant" ? (
              <div
                className={cn(
                  "prose prose-sm max-w-none break-words dark:prose-invert",
                  "prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-li:my-0.5",
                  "prose-strong:text-foreground prose-headings:my-2 prose-headings:text-base prose-headings:font-semibold",
                )}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{m.content}</p>
            )}
          </div>
        ))}
        {sending ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your reply…"
          className={cn(fieldBase, "flex-1")}
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendUser();
            }
          }}
        />
        <Button type="button" className="rounded-sm px-3" disabled={sending || !input.trim()} onClick={() => void sendUser()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {ready ? (
        <form
          id={AI_SIGNUP_FORM_ID}
          onSubmit={(ev) => void createAccount(ev)}
          className={cn("space-y-3 border-t border-border/60 pt-4", FORM_FOCUS_SAFE)}
        >
          <p className="text-xs font-medium text-muted-foreground">
            Secure step — email and password on device only.
          </p>
          <div>
            <Label htmlFor="ai-email">Email</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ai-email"
                type="email"
                autoComplete="email"
                className={cn(fieldBase, "pl-9")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormError(null);
                  setEmailRegistered(null);
                }}
              />
            </div>
            {emailLookupPending && isValidEmailFormat(email.trim()) ? (
              <p className="mt-1 text-xs text-muted-foreground">Checking email…</p>
            ) : null}
            {emailRegistered === true ? (
              <p className="mt-1 text-xs font-medium text-destructive">
                Already registered.{" "}
                <Link href="/login" className="underline underline-offset-2">
                  Sign in
                </Link>
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="ai-password">Password</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ai-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className={cn(fieldBase, "pl-9 pr-10")}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFormError(null);
                }}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              checked={terms}
              onCheckedChange={(v) => {
                setTerms(!!v);
                setFormError(null);
              }}
              className="mt-0.5 rounded-sm"
            />
            <span className="text-muted-foreground">
              I agree to the Terms and Privacy Policy.
            </span>
          </label>
        </form>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Chat until we have your <strong className="font-medium text-foreground">name</strong>,{" "}
          <strong className="font-medium text-foreground">role</strong>, and a little role-specific context — then
          this secure step unlocks.
        </p>
      )}
    </div>
  );
}
