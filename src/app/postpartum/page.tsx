"use client";
import { useState } from "react";
import Link from "next/link";

import { Heart, Baby, Smile, AlertTriangle, MessageCircle, Phone } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MOODS = [
  { key: "happy", label: "Happy", emoji: "😊" },
  { key: "okay", label: "Okay", emoji: "🙂" },
  { key: "tired", label: "Tired", emoji: "😴" },
  { key: "stressed", label: "Stressed", emoji: "😟" },
  { key: "overwhelmed", label: "Overwhelmed", emoji: "😢" },
] as const;

export default function PostpartumPage() {
  const [mood, setMood] = useState<string | null>(null);
  const week = 3;

  return (
    <AppShell>
      <AppHeader title="Postpartum support" showBack />
      <div className="space-y-5 px-4 pt-4">
        {/* Recovery */}
        <Card className="overflow-hidden border-0 bg-gradient-warm p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
            Recovery tracker
          </p>
          <p className="font-display text-3xl font-semibold">Week {week}</p>
          <p className="text-sm text-muted-foreground">since delivery</p>
          <div className="mt-3 flex gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 flex-1 rounded-full",
                  i < week ? "bg-primary" : "bg-card",
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Most healing happens in the first 6 weeks. Be patient with yourself. 🤍
          </p>
        </Card>

        {/* Breastfeeding */}
        <Card className="p-4 shadow-soft">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Baby className="h-5 w-5" />
            </span>
            <h2 className="font-display text-base font-semibold">Breastfeeding guide</h2>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="rounded-xl bg-muted/60 p-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule</p>
              <p>Feed every 2–3 hours, 8–12 times in 24h.</p>
            </li>
            <li className="rounded-xl bg-muted/60 p-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tip</p>
              <p>Drink water with every feed. Side-lying eases night feeds.</p>
            </li>
          </ul>
        </Card>

        {/* Mood check */}
        <Card className="p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Smile className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold">How are you feeling?</h2>
              <p className="text-xs text-muted-foreground">Quick weekly mood check</p>
            </div>
          </div>
          <div className="flex justify-between gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMood(m.key)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-medium transition-all",
                  mood === m.key
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:border-primary/40",
                )}
              >
                <span className="text-2xl">{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Alerts */}
        <Card className="border-risk-medium/40 bg-risk-medium/40 p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-risk-medium-foreground">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-sm font-semibold text-risk-medium-foreground">
                Watch for postpartum depression
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-risk-medium-foreground/90">
                If sadness, hopelessness, or trouble bonding lasts &gt; 2 weeks, please talk to a
                doctor. You are not alone.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href="/chat">
              <MessageCircle className="mr-1.5 h-4 w-4" /> Talk to AI
            </Link>
          </Button>
          <Button asChild className="rounded-2xl">
            <Link href="/emergency">
              <Phone className="mr-1.5 h-4 w-4" /> Contact doctor
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
