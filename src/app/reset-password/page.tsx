"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Lock } from "lucide-react";
import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { refreshSession, updatePassword } from "@/lib/auth-client";
import { toast } from "sonner";

export default function ResetPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  useEffect(() => {
    void refreshSession().then((u) => {
      setSessionReady(!!u);
    });
  }, []);

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Open the reset link from your email first — this page only works after that link signs you in for a one-time password change."
      footer={
        <>
          <Link href="/login" className="font-medium text-primary">
            Back to log in
          </Link>
        </>
      }
    >
      {sessionReady === false ? (
        <div className="space-y-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
          <p>You are not signed in with a recovery session yet. Use the link in your reset email (it should open this site), then return to this page.</p>
          <Button asChild variant="outline" className="w-full rounded-full">
            <Link href="/forgot-password">Request a new reset link</Link>
          </Button>
        </div>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password.length < 8) return toast.error("Password must be at least 8 characters");
          if (password !== confirm) return toast.error("Passwords don't match");
          setLoading(true);
          try {
            const result = await updatePassword(password);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Password updated. You can continue signed in.");
            router.push("/app");
          } finally {
            setLoading(false);
          }
        }}
      >
        <Field id="password" label="New password" value={password} onChange={setPassword} />
        <Field id="confirm" label="Confirm password" value={confirm} onChange={setConfirm} />
        <Button className="w-full rounded-full" type="submit" disabled={loading || sessionReady === false}>
          {loading ? "Updating…" : "Update password"}
        </Button>
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
        <Input
          id={id}
          type="password"
          autoComplete={id === "password" ? "new-password" : "new-password"}
          placeholder="••••••••"
          className="min-w-0 pl-9"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
