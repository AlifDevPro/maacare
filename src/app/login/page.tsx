"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';

import { Mail, Lock, ChevronRight } from "lucide-react";
import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginWithPassword } from "@/lib/auth-client";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
      router.push("/app");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue your journey."
      footer={<>New to MaaCare? <Link href="/signup" className="font-medium text-primary">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <div className="relative mt-1.5">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" placeholder="you@example.com" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-primary">Forgot?</Link>
          </div>
          <div className="relative mt-1.5">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="password" type="password" placeholder="••••••••" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full rounded-full shadow-soft">
          {loading ? "Signing in…" : <>Log in <ChevronRight className="ml-1 h-4 w-4" /></>}
        </Button>
        <div className="relative my-2 text-center text-xs text-muted-foreground">
          <span className="bg-card px-2 relative z-10">or</span>
          <span className="absolute left-0 right-0 top-1/2 -z-0 h-px bg-border" />
        </div>
        <Button type="button" variant="outline" className="w-full rounded-full" onClick={() => { toast.info("OTP sent to your email (demo)"); router.push("/verify-otp"); }}>
          Send me a one-time code
        </Button>
      </form>
    </AuthShell>
  );
}
