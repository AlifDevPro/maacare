"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { safeInternalPath } from "@/lib/auth/safe-internal-path";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Query `type` values GoTrue may send with `token_hash` (email links). */
const EMAIL_LINK_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const next = safeInternalPath(searchParams.get("next"), "/app");
      const oauthErr =
        searchParams.get("error_description")?.trim() || searchParams.get("error")?.trim();
      if (oauthErr) {
        if (!cancelled) {
          setErrorMsg(oauthErr);
        }
        return;
      }

      const supabase = createSupabaseBrowserClient();

      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (cancelled) return;
        if (error) {
          console.error("[auth/callback] exchangeCodeForSession:", error.message);
          setErrorMsg(error.message || "This link is invalid or has expired.");
          return;
        }
        router.replace(next);
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
          console.error("[auth/callback] verifyOtp:", error.message);
          setErrorMsg(error.message || "This link is invalid or has expired.");
          return;
        }
        router.replace(next);
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
            console.error("[auth/callback] setSession:", error.message);
            setErrorMsg(error.message || "Could not complete sign-in from this link.");
            return;
          }
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          }
          router.replace(next);
          return;
        }
      }

      if (!cancelled) {
        setErrorMsg(
          "This page needs a valid sign-in link from your email. Request a new reset link or confirmation email.",
        );
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (!errorMsg) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground">
        <p>Completing sign-in…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
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
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
