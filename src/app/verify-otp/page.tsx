"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { REGEXP_ONLY_DIGITS } from "input-otp";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { safeInternalPath } from "@/lib/auth/safe-internal-path";
import { requestPasswordReset, sendLoginEmailOtp, verifyLoginEmailOtp } from "@/lib/auth-client";
import { toast } from "sonner";

const RESEND_SECONDS = 60;
/** Supabase email OTPs are numeric; hosted projects may use 6 or 8 digits. */
const OTP_MAX_LEN = 8;

function isValidEmailOtpToken(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return /^\d{6}$/.test(digits) || /^\d{8}$/.test(digits);
}

function normalizeEmailOtp(raw: string): string {
  return raw.replace(/\D/g, "");
}

function VerifyOtpInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email")?.trim() ?? "";
  const isReset = searchParams.get("flow") === "reset";
  const next = safeInternalPath(searchParams.get("next"), isReset ? "/reset-password" : "/app");

  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const submit = async () => {
    if (!emailParam) {
      toast.error(
        isReset
          ? "Missing email. Go back to forgot password and request a code again."
          : "Missing email. Go back to log in and request a code again.",
      );
      return;
    }
    const token = normalizeEmailOtp(code);
    if (!isValidEmailOtpToken(code)) {
      return toast.error("Enter the full code from your email (6 or 8 digits, numbers only).");
    }
    setVerifying(true);
    try {
      const result = await verifyLoginEmailOtp(emailParam, token, {
        flow: isReset ? "password-reset" : "sign-in",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (isReset) {
        toast.success("Code verified — choose a new password.");
        router.replace(next);
      } else {
        toast.success("Signed in");
        router.push(next);
      }
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (!emailParam) return;
    setResending(true);
    try {
      const result = isReset ? await requestPasswordReset(emailParam) : await sendLoginEmailOtp(emailParam);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
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
            We sent a code to <span className="font-medium text-foreground">{emailParam}</span>. Enter every digit
            below (Supabase may send 6 or 8), then set a new password (or use the link in the same email).
          </>
        ) : (
          <>
            We sent a sign-in code to <span className="font-medium text-foreground">{emailParam}</span>. Enter every
            digit below — 6 or 8 digits, depending on your project — or use the link in the same email.
          </>
        )
      }
      footer={
        <Link href={isReset ? "/forgot-password" : "/login"} className="font-medium text-primary">
          {isReset ? "Back to forgot password" : "Back to log in"}
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-2">
          <InputOTP
            maxLength={OTP_MAX_LEN}
            pattern={REGEXP_ONLY_DIGITS}
            pasteTransformer={(pasted) => pasted.replace(/\D/g, "").slice(0, OTP_MAX_LEN)}
            value={code}
            onChange={setCode}
          >
            <InputOTPGroup>
              {Array.from({ length: OTP_MAX_LEN }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <p className="text-center text-xs text-muted-foreground">6 or 8 digits — use the full code from the email.</p>
        </div>
        <Button
          onClick={() => void submit()}
          className="w-full rounded-full"
          disabled={verifying || !isValidEmailOtpToken(code)}
        >
          {verifying ? "Verifying…" : isReset ? "Verify & set new password" : "Verify & continue"}
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
              {resending ? "Sending…" : "Resend code"}
            </button>
          )}
        </p>
      </div>
    </AuthShell>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Loading…</div>
      }
    >
      <VerifyOtpInner />
    </Suspense>
  );
}
