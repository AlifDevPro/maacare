"use client";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchJsonCached, invalidateCached } from "@/lib/client/request-cache";

type FlagKey = "ai_chat" | "community" | "reports" | "emergency";
type Flags = Record<FlagKey, boolean>;

const defaultFlags: Flags = {
  ai_chat: true,
  community: true,
  reports: true,
  emergency: true,
};

export default function AdminSettings() {
  const [flags, setFlags] = useState<Flags>(defaultFlags);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<FlagKey | null>(null);

  const items = [
    { id: "ai_chat", label: "AI Chat", desc: "Enable the Gemini-grounded chat feature." },
    { id: "community", label: "Community", desc: "Allow posts and replies." },
    { id: "reports", label: "Report simplifier", desc: "Enable medical report OCR & simplification." },
    { id: "emergency", label: "Emergency map", desc: "Show nearby hospitals and hotlines." },
  ] as const;

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const key = "admin:settings";
        const { data: j } = await fetchJsonCached<{ flags?: Flags }>(
          key,
          "/api/admin/settings",
          { credentials: "include" },
          60_000,
        );
        if (active) setFlags({ ...defaultFlags, ...(j.flags ?? {}) });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load settings.");
        if (active) setFlags(defaultFlags);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function updateFlag(key: FlagKey, enabled: boolean) {
    const prev = flags[key];
    setFlags((old) => ({ ...old, [key]: enabled }));
    setSavingKey(key);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not update setting.");
      invalidateCached("admin:settings");
      toast.success("Setting updated");
    } catch (e) {
      setFlags((old) => ({ ...old, [key]: prev }));
      toast.error(e instanceof Error ? e.message : "Could not update setting.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Feature flags and app configuration.</p>
      </div>
      <Card className="divide-y divide-border p-0">
        {items.map((f) => (
          <div key={f.id} className="flex items-center justify-between p-5">
            <div>
              <Label htmlFor={f.id} className="text-sm font-medium">{f.label}</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">{f.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              {savingKey === f.id ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              <Switch
                id={f.id}
                checked={flags[f.id]}
                disabled={loading || savingKey === f.id}
                onCheckedChange={(next) => void updateFlag(f.id, next)}
              />
            </div>
          </div>
        ))}
      </Card>
      <Card className="p-5">
        <h2 className="font-display text-base font-semibold">Email templates</h2>
        <p className="mt-1 text-sm text-muted-foreground">Configure transactional email content (welcome, OTP, reset). Coming soon.</p>
      </Card>
    </div>
  );
}
