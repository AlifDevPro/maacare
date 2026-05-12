"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { safeInternalPath } from "@/lib/auth/safe-internal-path";
import { sendLoginEmailOtp, verifyLoginEmailOtp } from "@/lib/auth-client";
import { toast } from "sonner";

const RESEND_SECONDS = 60;

function VerifyOtpInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email")?.trim() ?? "";
  const next = safeInternalPath(searchParams.get("next"), "/app");

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
      toast.error("Missing email. Go back to log in and request a code again.");
      return;
    }
    if (code.length !== 6) return toast.error("Enter the 6-digit code");
    setVerifying(true);
    try {
      const result = await verifyLoginEmailOtp(emailParam, code);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Signed in");
      router.push(next);
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (!emailParam) return;
    setResending(true);
    try {
      const result = await sendLoginEmailOtp(emailParam);
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
        title="Verify your email"
        subtitle="Request a code from the log in page first."
        footer={
          <Link href="/login" className="font-medium text-primary">
            Back to log in
          </Link>
        }
      >
        <p className="text-center text-sm text-muted-foreground">No email was provided in the link.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle={
        <>
          We sent a sign-in code to <span className="font-medium text-foreground">{emailParam}</span>. Enter it
          below (or use the link in the same email).
        </>
      }
      footer={
        <Link href="/login" className="font-medium text-primary">
          Back to log in
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button onClick={() => void submit()} className="w-full rounded-full" disabled={verifying}>
          {verifying ? "Verifying…" : "Verify & continue"}
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
