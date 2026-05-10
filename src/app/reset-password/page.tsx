"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';

import { Lock } from "lucide-react";
import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ResetPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you'll remember.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (password.length < 8) return toast.error("Password must be at least 8 characters");
          if (password !== confirm) return toast.error("Passwords don't match");
          toast.success("Password updated");
          router.push("/login");
        }}
      >
        <Field id="password" label="New password" value={password} onChange={setPassword} />
        <Field id="confirm" label="Confirm password" value={confirm} onChange={setConfirm} />
        <Button className="w-full rounded-full" type="submit">Update password</Button>
      </form>
    </AuthShell>
  );
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1.5">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={id} type="password" placeholder="••••••••" className="pl-9" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}
