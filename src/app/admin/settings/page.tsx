"use client";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function AdminSettings() {
  const flags = [
    { id: "ai_chat", label: "AI Chat", desc: "Enable the Gemini-grounded chat feature." },
    { id: "community", label: "Community", desc: "Allow posts and replies." },
    { id: "reports", label: "Report simplifier", desc: "Enable medical report OCR & simplification." },
    { id: "emergency", label: "Emergency map", desc: "Show nearby hospitals and hotlines." },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Feature flags and app configuration.</p>
      </div>
      <Card className="divide-y divide-border p-0">
        {flags.map((f) => (
          <div key={f.id} className="flex items-center justify-between p-5">
            <div>
              <Label htmlFor={f.id} className="text-sm font-medium">{f.label}</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">{f.desc}</p>
            </div>
            <Switch id={f.id} defaultChecked />
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
