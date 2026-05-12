"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Mail } from "lucide-react";
import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/auth-client";
import { isValidEmailFormat } from "@/lib/validation/email";
import { toast } from "sonner";

export default function ForgotPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const canSend = useMemo(() => isValidEmailFormat(email), [email]);

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a one-time code (often 6 or 8 digits). Enter it on the next screen, then choose a new password."
      footer={
        <>
          <Link href="/login" className="font-medium text-primary">
            Back to log in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!email.trim()) return toast.error("Enter your email");
          if (!isValidEmailFormat(email)) {
            return toast.error("Enter a valid email address");
          }
          setLoading(true);
          try {
            const result = await requestPasswordReset(email.trim());
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(result.message);
            router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}&flow=reset`);
          } finally {
            setLoading(false);
          }
        }}
      >
        <div>
          <Label htmlFor="email">Email</Label>
          <div className="relative mt-1.5">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="min-w-0 pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          {email.trim() && !canSend ? (
            <p className="mt-1.5 text-xs text-destructive">Enter a valid email address (include @ and a domain).</p>
          ) : null}
        </div>
        <Button className="w-full rounded-full" type="submit" disabled={loading || !canSend}>
          {loading ? "Sending…" : "Send verification code"}
        </Button>
      </form>
    </AuthShell>
  );
}
