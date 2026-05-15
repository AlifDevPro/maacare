"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { AuthShell } from "@/components/app/AuthShell";
import {
  AUTH_CARD_PANEL_MIN_H,
  AuthCardBackButton,
  AuthInlineAlert,
  AuthMailSendingState,
} from "@/components/auth/auth-inline-feedback";
import {
  AuthOtpFields,
  isValidEmailOtpToken,
  normalizeEmailOtp,
} from "@/components/auth/auth-otp-fields";
import { Button } from "@/components/ui/button";
import { safeInternalPath } from "@/lib/auth/safe-internal-path";
import { requestPasswordReset, sendLoginEmailOtp, verifyLoginEmailOtp } from "@/lib/auth-client";

const RESEND_SECONDS = 60;

function VerifyOtpInner() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email")?.trim() ?? "";
  const isReset = searchParams.get("flow") === "reset";
  const next = safeInternalPath(searchParams.get("next"), isReset ? "/reset-password" : "/app");

  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const submit = async () => {
    if (!emailParam) {
      setFormError(
        isReset
          ? "Missing email. Go back to forgot password and request a code again."
          : "Missing email. Go back to log in and request a code again.",
      );
      return;
    }
    if (!isValidEmailOtpToken(code)) {
      setFormError("Enter the full 8-digit code from your email.");
      return;
    }

    setFormError(null);
    setVerifying(true);
    try {
      const result = await verifyLoginEmailOtp(emailParam, normalizeEmailOtp(code), {
        flow: isReset ? "password-reset" : "sign-in",
      });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      if (isReset) {
        router.replace(next);
      } else {
        router.push(next);
      }
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (!emailParam) return;
    setFormError(null);
    setResending(true);
    try {
      const result = isReset
        ? await requestPasswordReset(emailParam)
        : await sendLoginEmailOtp(emailParam);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setSeconds(RESEND_SECONDS);
    } finally {
      setResending(false);
    }
  };

  if (!emailParam) {
    return (
      <AuthShell
        title="Missing email"
        subtitle={
          isReset
            ? "Start from forgot password so we know which email to send the code to."
            : "Request a code from the log in page first."
        }
        footer={
          <Link href={isReset ? "/forgot-password" : "/login"} className="font-medium text-primary">
            {isReset ? "Back to forgot password" : "Back to log in"}
          </Link>
        }
      >
        <p className="text-center text-sm text-muted-foreground">No email was provided in the link.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={isReset ? "Verify to reset password" : "Verify your email"}
      subtitle={
        isReset ? (
          <>
            We sent a code to <span className="font-medium text-foreground">{emailParam}</span>.
            Enter every digit below, then set a new password.
          </>
        ) : (
          <>
            We sent a sign-in code to <span className="font-medium text-foreground">{emailParam}</span>.
            Enter the 8-digit code below.
          </>
        )
      }
      footer={
        <Link href={isReset ? "/forgot-password" : "/login"} className="font-medium text-primary">
          {isReset ? "Back to forgot password" : "Back to log in"}
        </Link>
      }
    >
      <motion.div layout className={AUTH_CARD_PANEL_MIN_H}>
        {resending ? (
          <AuthMailSendingState
            label={t("auth_mail_sending")}
            onBack={() => setResending(false)}
            backLabel={t("auth_back")}
          />
        ) : (
          <div className="space-y-5">
            <AuthCardBackButton
              onClick={() => router.push(isReset ? "/forgot-password" : "/login")}
              label={t("auth_back")}
              className="mb-0"
            />
            {formError ? <AuthInlineAlert message={formError} /> : null}
            <AuthOtpFields
              code={code}
              onCodeChange={(value) => {
                setCode(value);
                setFormError(null);
              }}
              onVerify={() => void submit()}
              verifying={verifying}
              verifyLabel={isReset ? t("auth_verify_reset") : t("auth_verify_continue")}
              hint={t("auth_otp_hint")}
              disabled={verifying}
            />
            <Button
              onClick={() => void submit()}
              className="w-full rounded-full"
              disabled={verifying || !isValidEmailOtpToken(code)}
            >
              {verifying ? t("auth_verifying") : isReset ? t("auth_verify_reset") : t("auth_verify_continue")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {seconds > 0 ? (
                <>
                  Resend code in{" "}
                  <span className="font-medium text-foreground">
                    {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
                  </span>
                </>
              ) : (
                <button
                  type="button"
                  disabled={resending}
                  onClick={() => void resend()}
                  className="font-medium text-primary disabled:opacity-50"
                >
                  Resend code
                </button>
              )}
            </p>
          </div>
        )}
      </motion.div>
    </AuthShell>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <VerifyOtpInner />
    </Suspense>
  );
}
