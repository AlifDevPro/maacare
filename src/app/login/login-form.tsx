"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Mail, Lock, ChevronRight } from "lucide-react";
import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeInternalPath } from "@/lib/auth/safe-internal-path";
import { loginWithPassword, sendLoginEmailOtp } from "@/lib/auth-client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

function LoginFormInner() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "auth_callback") {
      toast.error(t("toast_auth_link_invalid"));
    } else if (err === "missing_code") {
      toast.error(t("toast_missing_code"));
    }
  }, [searchParams]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error(t("toast_enter_both"));
    setLoading(true);
    try {
      const result = await loginWithPassword(email, password);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("toast_welcome_back"));
      const next = safeInternalPath(searchParams.get("next"), "/app");
      router.push(next);
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!email.trim()) return toast.error(t("toast_enter_email"));
    setOtpSending(true);
    try {
      const result = await sendLoginEmailOtp(email.trim());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}`);
    } finally {
      setOtpSending(false);
    }
  };

  return (
    <AuthShell
      title={t("login_title")}
      subtitle={t("login_subtitle")}
      footer={
        <>
          {t("login_footer_new")}{" "}
          <Link href="/signup" className="font-medium text-primary">
            {t("login_footer_create")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <div className="relative mt-1.5">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="min-w-0 pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("password")}</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-primary">
              {t("forgot")}
            </Link>
          </div>
          <div className="relative mt-1.5">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="min-w-0 pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full rounded-full">
          {loading ? t("signing_in") : (
            <>
              {t("log_in_button")} <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
        <div className="relative my-2 text-center text-xs text-muted-foreground">
          <span className="relative z-10 bg-card px-2">{t("or_divider")}</span>
          <span className="absolute left-0 right-0 top-1/2 -z-0 h-px bg-border" />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-full"
          disabled={otpSending}
          onClick={() => void sendOtp()}
        >
          {otpSending ? t("sending_code") : t("send_otp")}
        </Button>
      </form>
    </AuthShell>
  );
}

function LoginFormLoadingFallback() {
  const { t } = useTranslation("auth");
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      {t("loading")}
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<LoginFormLoadingFallback />}>
      <LoginFormInner />
    </Suspense>
  );
}
