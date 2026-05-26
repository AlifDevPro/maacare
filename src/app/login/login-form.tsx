"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, Lock, ChevronRight, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AuthShell } from "@/components/app/AuthShell";
import {
  AUTH_CARD_PANEL_MIN_H,
  AuthInlineAlert,
  AuthMailSendingState,
  AuthMailSuccessState,
} from "@/components/auth/auth-inline-feedback";
import {
  AuthOtpFields,
  isValidEmailOtpToken,
  normalizeEmailOtp,
} from "@/components/auth/auth-otp-fields";
import {
  LoginAuthLockOverlay,
  loginUnlockRedirectMs,
  type LoginAuthLockPhase,
} from "@/components/auth/login-auth-lock-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthUrlError } from "@/lib/auth/use-auth-url-error";
import { safeInternalPath } from "@/lib/auth/safe-internal-path";
import {
  loginWithPassword,
  sendLoginEmailOtp,
  verifyLoginEmailOtp,
} from "@/lib/auth-client";

type AuthUiPhase = "idle" | LoginAuthLockPhase;
type OtpUiPhase = "hidden" | "sending" | "sent";

function LoginFormInner() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authPhase, setAuthPhase] = useState<AuthUiPhase>("idle");
  const [otpPhase, setOtpPhase] = useState<OtpUiPhase>("hidden");
  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  const busy = authPhase !== "idle";
  const otpBusy = otpPhase === "sending" || otpVerifying;

  const clearFormError = useCallback(() => setFormError(null), []);

  useAuthUrlError(
    searchParams,
    "/login",
    {
      auth_callback: t("toast_auth_link_invalid"),
      missing_code: t("toast_missing_code"),
    },
    setFormError,
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || otpBusy) return;
    setFormError(null);
    if (!email || !password) {
      setFormError(t("auth_error_enter_both"));
      return;
    }

    setAuthPhase("authenticating");
    const next = safeInternalPath(searchParams.get("next"), "/app");

    try {
      const result = await loginWithPassword(email, password);
      if (!result.ok) {
        setFormError(result.error);
        setAuthPhase("idle");
        return;
      }
      setFormError(null);
      setAuthPhase("success");
      await new Promise((resolve) =>
        setTimeout(resolve, loginUnlockRedirectMs(reducedMotion)),
      );
      router.push(next);
    } catch {
      setFormError(t("auth_error_enter_both"));
      setAuthPhase("idle");
    }
  };

  const sendOtp = async () => {
    if (busy || otpBusy) return;
    setFormError(null);
    setOtpError(null);
    if (!email.trim()) {
      setFormError(t("auth_error_enter_email"));
      return;
    }

    setOtpPhase("sending");
    try {
      const result = await sendLoginEmailOtp(email.trim());
      if (!result.ok) {
        setFormError(result.error);
        setOtpPhase("hidden");
        return;
      }
      setOtpPhase("sent");
    } catch {
      setFormError(t("auth_error_enter_email"));
      setOtpPhase("hidden");
    }
  };

  const verifyOtp = async () => {
    if (!isValidEmailOtpToken(otpCode)) return;
    setOtpError(null);
    setOtpVerifying(true);
    const next = safeInternalPath(searchParams.get("next"), "/app");
    try {
      const result = await verifyLoginEmailOtp(email.trim(), normalizeEmailOtp(otpCode), {
        flow: "sign-in",
      });
      if (!result.ok) {
        setOtpError(result.error);
        return;
      }
      router.push(next);
    } catch {
      setOtpError(t("auth_error_enter_email"));
    } finally {
      setOtpVerifying(false);
    }
  };

  const resetOtpFlow = () => {
    setOtpPhase("hidden");
    setOtpCode("");
    setOtpError(null);
    setFormError(null);
  };

  return (
    <AuthShell
      title={t("login_title")}
      subtitle={busy || otpPhase === "sent" ? undefined : t("login_subtitle")}
      footer={
        busy || otpPhase === "sending" || otpPhase === "sent" ? null : (
          <>
            {t("login_footer_new")}{" "}
            <Link href="/signup" className="font-medium text-primary">
              {t("login_footer_create")}
            </Link>
          </>
        )
      }
    >
      <motion.div layout className={AUTH_CARD_PANEL_MIN_H}>
        {busy ? (
          <LoginAuthLockOverlay
            phase={authPhase}
            authenticatingLabel={t("login_authenticating")}
            successLabel={t("login_unlocked")}
          />
        ) : otpPhase === "sending" ? (
          <AuthMailSendingState
            label={t("auth_mail_sending")}
            onBack={resetOtpFlow}
            backLabel={t("auth_back")}
          />
        ) : otpPhase === "sent" ? (
          <AuthMailSuccessState
            title={t("auth_mail_success_title")}
            body={t("auth_mail_success_body")}
            email={email.trim()}
            onBack={resetOtpFlow}
            backLabel={t("auth_back")}
          >
            {otpError ? <AuthInlineAlert message={otpError} className="mb-2" /> : null}
            <AuthOtpFields
              code={otpCode}
              onCodeChange={(value) => {
                setOtpCode(value);
                setOtpError(null);
              }}
              onVerify={() => void verifyOtp()}
              verifying={otpVerifying}
              verifyLabel={t("auth_verify_continue")}
              hint={t("auth_otp_hint")}
              disabled={otpVerifying}
            />
          </AuthMailSuccessState>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {formError ? <AuthInlineAlert message={formError} /> : null}
            <motion.div>
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFormError();
                  }}
                />
              </div>
            </motion.div>
            <div>
              <motion.div className="flex items-center justify-between">
                <Label htmlFor="password">{t("password")}</Label>
                <Link href="/forgot-password" className="text-xs font-medium text-primary">
                  {t("forgot")}
                </Link>
              </motion.div>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="min-w-0 pl-9 pr-10"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFormError();
                  }}
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
            <Button type="submit" disabled={busy} className="w-full rounded-full">
              {t("log_in_button")} <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <div className="relative my-2 text-center text-xs text-muted-foreground">
              <span className="relative z-10 bg-card px-2">{t("or_divider")}</span>
              <span className="absolute left-0 right-0 top-1/2 -z-0 h-px bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full"
              disabled={otpBusy}
              onClick={() => void sendOtp()}
            >
              {t("send_otp")}
            </Button>
          </form>
        )}
      </motion.div>
    </AuthShell>
  );
}

function LoginFormLoadingFallback() {
  const { t } = useTranslation("auth");
  return (
    <motion.div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      {t("loading")}
    </motion.div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<LoginFormLoadingFallback />}>
      <LoginFormInner />
    </Suspense>
  );
}
