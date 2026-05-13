"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CheckCircle2, Loader2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { safeInternalPath } from "@/lib/auth/safe-internal-path";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useTranslation } from "react-i18next";

/** Query `type` values GoTrue may send with `token_hash` (email links). */
const EMAIL_LINK_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/** Full page load so middleware + RSC see cookies set by `exchangeCodeForSession` / `verifyOtp`. */
function completeAuthRedirect(next: string) {
  window.location.assign(next);
}

function callbackDedupeKey(): string | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const code = q.get("code");
  if (code) return `code:${code}`;
  const th = q.get("token_hash");
  if (th) return `token:${th}`;
  const h = window.location.hash.replace(/^#/, "");
  if (h.length > 12) return `hash:${h.slice(0, 160)}`;
  return null;
}

const AUTH_CB_DEDUPE_PREFIX = "maacare:authcb:";

function readDedupePayload(key: string | null): { next: string; signup: boolean } | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AUTH_CB_DEDUPE_PREFIX + key);
    if (!raw) return null;
    const j = JSON.parse(raw) as { next?: string; signup?: boolean };
    if (typeof j.next !== "string") return null;
    return { next: j.next, signup: !!j.signup };
  } catch {
    return null;
  }
}

function writeDedupePayload(key: string | null, next: string, signup: boolean) {
  if (!key || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(AUTH_CB_DEDUPE_PREFIX + key, JSON.stringify({ next, signup }));
  } catch {
    // ignore
  }
}

type Phase = "loading" | "success" | "error";

function AuthCallbackInner() {
  const { t } = useTranslation("health");
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNext, setSuccessNext] = useState<string>("/app");
  const [successVariant, setSuccessVariant] = useState<"signup" | "default">("default");
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const next = safeInternalPath(searchParams.get("next"), "/app");
      const flow = searchParams.get("flow");
      const emailLinkType = searchParams.get("type");
      const signupCopy = flow === "signup" || emailLinkType === "signup";
      const dedupeKey = typeof window !== "undefined" ? callbackDedupeKey() : null;

      const oauthErr =
        searchParams.get("error_description")?.trim() || searchParams.get("error")?.trim();
      if (oauthErr) {
        if (!cancelled) {
          setErrorMsg(oauthErr);
          setPhase("error");
        }
        return;
      }

      const cached = readDedupePayload(dedupeKey);
      if (cached) {
        const n = safeInternalPath(cached.next, "/app");
        if (!cancelled) {
          try {
            const u = new URL(window.location.origin + "/auth/callback");
            u.searchParams.set("next", n);
            if (cached.signup) u.searchParams.set("flow", "signup");
            window.history.replaceState(null, "", u.pathname + u.search);
          } catch {
            // ignore
          }
          setSuccessNext(n);
          setSuccessVariant(cached.signup ? "signup" : "default");
          setPhase("success");
        }
        return;
      }

      const supabase = createSupabaseBrowserClient();

      const markSuccess = () => {
        if (cancelled) return;
        writeDedupePayload(dedupeKey, next, signupCopy);
        try {
          const u = new URL(window.location.origin + "/auth/callback");
          u.searchParams.set("next", next);
          if (signupCopy) u.searchParams.set("flow", "signup");
          window.history.replaceState(null, "", u.pathname + u.search);
        } catch {
          // ignore
        }
        setSuccessNext(next);
        setSuccessVariant(signupCopy ? "signup" : "default");
        setPhase("success");
      };

      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (cancelled) return;
        if (error) {
          const { data: sess } = await supabase.auth.getSession();
          if (sess.session) {
            markSuccess();
            return;
          }
          console.error("[auth/callback] exchangeCodeForSession:", error.message);
          setErrorMsg(error.message || "This link is invalid or has expired.");
          setPhase("error");
          return;
        }
        markSuccess();
        return;
      }

      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      if (tokenHash && type && EMAIL_LINK_TYPES.has(type)) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email",
        });
        if (cancelled) return;
        if (error) {
          const { data: sess } = await supabase.auth.getSession();
          if (sess.session) {
            markSuccess();
            return;
          }
          console.error("[auth/callback] verifyOtp:", error.message);
          setErrorMsg(error.message || "This link is invalid or has expired.");
          setPhase("error");
          return;
        }
        markSuccess();
        return;
      }

      const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
      if (hash) {
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (cancelled) return;
          if (error) {
            const { data: sess } = await supabase.auth.getSession();
            if (sess.session) {
              markSuccess();
              return;
            }
            console.error("[auth/callback] setSession:", error.message);
            setErrorMsg(error.message || "Could not complete sign-in from this link.");
            setPhase("error");
            return;
          }
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          }
          markSuccess();
          return;
        }
      }

      const { data: sessCleanUrl } = await supabase.auth.getSession();
      if (!cancelled && sessCleanUrl.session && searchParams.get("next")) {
        markSuccess();
        return;
      }

      if (!cancelled) {
        setErrorMsg(
          "This page needs a valid sign-in link from your email. Request a new reset link or confirmation email.",
        );
        setPhase("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (phase !== "success" || !successNext) return;
    redirectTimerRef.current = window.setTimeout(() => {
      redirectTimerRef.current = null;
      completeAuthRedirect(successNext);
    }, 2800);
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [phase, successNext]);

  const onContinue = () => {
    if (redirectTimerRef.current) {
      window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    completeAuthRedirect(successNext);
  };

  if (phase === "loading") {
    return (
      <AppShell hideNav>
        <AppHeader title={t("account_title")} />
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Completing sign-in…</p>
        </div>
      </AppShell>
    );
  }

  if (phase === "success") {
    const title = successVariant === "signup" ? "You’re verified" : "You’re signed in";
    const subtitle =
      successVariant === "signup"
        ? "Your email is confirmed and your MaaCare account is ready. You can continue to the app whenever you like."
        : "Welcome back. Continue to the app to pick up where you left off.";

    return (
      <AppShell hideNav>
        <AppHeader title={t("account_title")} />
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 pb-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary shadow-soft">
            <CheckCircle2 className="h-9 w-9" aria-hidden />
          </div>
          <div className="max-w-sm space-y-2">
            <h1 className="font-display text-xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
            <p className="text-xs text-muted-foreground">Redirecting in a few seconds…</p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button type="button" className="min-h-11 w-full rounded-xl" onClick={onContinue}>
              Continue to MaaCare
            </Button>
            <Button type="button" variant="ghost" className="rounded-xl text-muted-foreground" asChild>
              <Link href="/login">Use another account</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideNav>
      <AppHeader title={t("account_title")} />
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="max-w-md text-sm text-muted-foreground">{errorMsg}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild variant="default" className="rounded-full">
            <Link href="/login">Back to log in</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/forgot-password">Forgot password</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function AuthCallbackSuspenseFallback() {
  const { t } = useTranslation("health");
  return (
    <AppShell hideNav>
      <AppHeader title={t("account_title")} />
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    </AppShell>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackSuspenseFallback />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
