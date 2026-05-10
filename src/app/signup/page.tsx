"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';

import { Mail, Lock, User, ChevronRight } from "lucide-react";
import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { registerAccount } from "@/lib/auth-client";
import { toast } from "sonner";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return toast.error("Please fill in all fields");
    if (!terms) return toast.error("Please accept the Terms");
    const result = await registerAccount(name, email, password);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if ("needsEmailConfirmation" in result && result.needsEmailConfirmation) {
      toast.info(result.message);
      router.push("/login");
      return;
    }
    toast.success("Welcome to MaaCare");
    router.push("/app");
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free during beta. No credit card required."
      footer={<>Already have an account? <Link href="/login" className="font-medium text-primary">Log in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="name">Full name</Label>
          <div className="relative mt-1.5">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="name" placeholder="Aisha Rahman" className="pl-9" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <div className="relative mt-1.5">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" placeholder="you@example.com" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative mt-1.5">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="password" type="password" placeholder="At least 8 characters" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox checked={terms} onCheckedChange={(v) => setTerms(!!v)} className="mt-0.5" />
          <span className="text-muted-foreground">I agree to the <a href="#" className="font-medium text-primary">Terms</a> and <a href="#" className="font-medium text-primary">Privacy Policy</a>.</span>
        </label>
        <Button type="submit" className="w-full rounded-full">
          Create account <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </form>
    </AuthShell>
  );
}
