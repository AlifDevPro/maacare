"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';

import { Mail } from "lucide-react";
import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ForgotPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to set a new password."
      footer={<><Link href="/login" className="font-medium text-primary">Back to log in</Link></>}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email) return toast.error("Enter your email");
          toast.success("Reset link sent (demo)");
          router.push("/reset-password");
        }}
      >
        <div>
          <Label htmlFor="email">Email</Label>
          <div className="relative mt-1.5">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" placeholder="you@example.com" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <Button className="w-full rounded-full shadow-soft" type="submit">Send reset link</Button>
      </form>
    </AuthShell>
  );
}
