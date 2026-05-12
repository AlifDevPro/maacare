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

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "auth_callback") {
      toast.error("That sign-in link is invalid or expired. Try logging in again.");
    } else if (err === "missing_code") {
      toast.error("Missing confirmation code. Open the full link from your email.");
    }
  }, [searchParams]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Enter your email and password");
    setLoading(true);
    try {
      const result = await loginWithPassword(email, password);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Welcome back!");
      const next = safeInternalPath(searchParams.get("next"), "/app");
      router.push(next);
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!email.trim()) return toast.error("Enter your email first");
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
      title="Welcome back"
      subtitle="Log in to continue your journey."
      footer={
        <>
          New to MaaCare?{" "}
          <Link href="/signup" className="font-medium text-primary">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
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
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-primary">
              Forgot?
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
          {loading ? "Signing in…" : (
            <>
              Log in <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
        <div className="relative my-2 text-center text-xs text-muted-foreground">
          <span className="relative z-10 bg-card px-2">or</span>
          <span className="absolute left-0 right-0 top-1/2 -z-0 h-px bg-border" />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-full"
          disabled={otpSending}
          onClick={() => void sendOtp()}
        >
          {otpSending ? "Sending code…" : "Send me a one-time code"}
        </Button>
      </form>
    </AuthShell>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
