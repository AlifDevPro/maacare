"use client";
import Link from "next/link";

import { Camera, Calendar, Heart, Globe, Bell, Download, LogOut, ChevronRight, Pencil } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function ProfilePage() {
  return (
    <AppShell>
      <AppHeader title="Profile" showBack />
      <div className="space-y-4 px-4 pt-4">
        {/* Avatar */}
        <Card className="overflow-hidden border-0 bg-gradient-hero p-5 shadow-card">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-card text-3xl shadow-soft">
                🌸
              </div>
              <button
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
                aria-label="Change photo"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl font-semibold">Aisha Rahman</h1>
              <p className="text-sm text-muted-foreground">Week 20 · Due Aug 12</p>
              <Button variant="outline" size="sm" className="mt-2 h-7 rounded-full text-xs">
                <Pencil className="mr-1 h-3 w-3" /> Edit profile
              </Button>
            </div>
          </div>
        </Card>

        {/* Pregnancy info */}
        <Section title="Pregnancy details">
          <Row icon={Calendar} label="Due date" value="Aug 12, 2026" />
          <Row icon={Calendar} label="Last period (LMP)" value="Nov 5, 2025" />
          <Row icon={Heart} label="Current week" value="Week 20" />
        </Section>

        {/* Health */}
        <Section title="Health information">
          <Row icon={Heart} label="Blood group" value="O+" />
          <Row icon={Heart} label="Allergies" value="None" />
          <Row icon={Heart} label="Conditions" value="—" />
        </Section>

        {/* Preferences */}
        <Section title="Preferences">
          <Row icon={Globe} label="Language" value="English" chevron />
          <ToggleRow icon={Bell} label="Daily reminders" defaultChecked />
          <ToggleRow icon={Bell} label="Community notifications" defaultChecked />
        </Section>

        {/* Data */}
        <Section title="Data & account">
          <Row icon={Download} label="Export my data" chevron />
          <Row icon={LogOut} label="Sign out" chevron danger />
        </Section>

        <p className="px-2 pb-2 text-center text-[11px] text-muted-foreground">
          MaaCare v1.0 · Made with care 🤍
        </p>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <Card className="divide-y divide-border shadow-soft">{children}</Card>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  chevron,
  danger,
}: {
  icon: typeof Heart;
  label: string;
  value?: string;
  chevron?: boolean;
  danger?: boolean;
}) {
  return (
    <button className="flex w-full items-center gap-3 px-4 py-3 text-left">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${danger ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className={`flex-1 text-sm font-medium ${danger ? "text-destructive" : ""}`}>{label}</span>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      {chevron && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}

function ToggleRow({ icon: Icon, label, defaultChecked }: { icon: typeof Heart; label: string; defaultChecked?: boolean }) {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
