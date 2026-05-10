"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';

import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";

export default function VerifyOtpPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(45);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const submit = () => {
    if (code.length !== 6) return toast.error("Enter the 6-digit code");
    toast.success("Email verified");
    router.push("/app");
  };

  return (
    <AuthShell title="Verify your email" subtitle="We sent a 6-digit code to your inbox.">
      <div className="space-y-5">
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => <InputOTPSlot key={i} index={i} />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button onClick={submit} className="w-full rounded-full shadow-soft">Verify & continue</Button>
        <p className="text-center text-xs text-muted-foreground">
          {seconds > 0 ? (
            <>Resend code in <span className="font-medium text-foreground">0:{String(seconds).padStart(2, "0")}</span></>
          ) : (
            <button onClick={() => { setSeconds(45); toast.success("New code sent"); }} className="font-medium text-primary">Resend code</button>
          )}
        </p>
      </div>
    </AuthShell>
  );
}
