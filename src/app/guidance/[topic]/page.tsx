"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from 'next/navigation';

import { Lightbulb, Stethoscope, MessageCircle, Check } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TOPICS: Record<string, { title: string; simple: string; medical: string; emoji: string }> = {
  hydration: {
    title: "Drink more water",
    simple: "Staying hydrated helps maintain amniotic fluid levels and supports baby's circulation.",
    medical: "During pregnancy, blood volume increases by ~50%. Adequate water intake (8–10 glasses/day) helps form amniotic fluid, transport nutrients, and reduce constipation and UTIs.",
    emoji: "💧",
  },
  movement: {
    title: "Light movement daily",
    simple: "Gentle walking or prenatal yoga improves circulation, mood, and sleep quality.",
    medical: "ACOG recommends 150 minutes/week of moderate-intensity activity for low-risk pregnancies. It reduces gestational diabetes risk and supports easier labor.",
    emoji: "🚶‍♀️",
  },
};

export default function GuidancePage() {
  const params = useParams<{ topic?: string }>();
const topic = typeof params.topic === "string" ? params.topic : "hydration";
  const t = TOPICS[topic] ?? TOPICS.hydration;
  const [tab, setTab] = useState<"simple" | "medical">("simple");

  return (
    <AppShell>
      <AppHeader title="Why this matters" showBack />
      <div className="space-y-5 px-4 pt-4">
        <Card className="overflow-hidden border-0 bg-gradient-warm p-6 text-center shadow-card">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-card text-3xl shadow-soft">
            {t.emoji}
          </div>
          <h1 className="font-display text-2xl font-semibold">{t.title}</h1>
        </Card>

        <div className="flex items-center gap-1 rounded-2xl bg-muted p-1">
          {(["simple", "medical"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-sm font-medium capitalize transition-colors",
                tab === k ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {k === "simple" ? "Simple" : "Medical insight"}
            </button>
          ))}
        </div>

        <Card className="p-4 shadow-soft">
          <div className="mb-2 flex items-center gap-2 text-primary">
            {tab === "simple" ? <Lightbulb className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
            <p className="text-xs font-semibold uppercase tracking-wider">
              {tab === "simple" ? "In plain words" : "What the research says"}
            </p>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {tab === "simple" ? t.simple : t.medical}
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="rounded-2xl">
            <Check className="mr-1.5 h-4 w-4" /> Got it
          </Button>
          <Button asChild className="rounded-2xl">
            <Link href="/chat">
              <MessageCircle className="mr-1.5 h-4 w-4" /> Ask AI more
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
