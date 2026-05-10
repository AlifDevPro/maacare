"use client";
import { useState } from "react";
import Link from "next/link";

import { motion } from "framer-motion";
import { Heart, Sparkles, Droplets, Moon, Activity, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { babyAt, trimesterOf } from "@/lib/pregnancy";

export default function HomePage() {
  const [week, setWeek] = useState(20);
  const baby = babyAt(week);
  const trimester = trimesterOf(week);

  return (
    <AppShell>
      <AppHeader brand showNotifications />

      <div className="space-y-5 px-4 pt-4">
        {/* Hero greeting */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <p className="text-sm text-muted-foreground">Good morning, beautiful</p>
          <h1 className="font-display text-2xl font-semibold leading-tight text-balance">
            How are you feeling today?
          </h1>
        </motion.div>

        {/* Week selector card */}
        <Card className="overflow-hidden border-0 bg-gradient-hero p-0 shadow-card">
          <div className="space-y-5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
                  Pregnancy week
                </p>
                <p className="font-display text-4xl font-semibold leading-none tracking-tight">
                  {week}
                  <span className="text-lg font-medium text-muted-foreground">/40</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Trimester {trimester} · {40 - week} weeks to go
                </p>
              </div>
              <motion.div
                key={baby.emoji}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-20 w-20 items-center justify-center rounded-3xl bg-card text-5xl shadow-soft animate-float"
              >
                {baby.emoji}
              </motion.div>
            </div>

            <Slider
              value={[week]}
              onValueChange={([v]) => setWeek(v)}
              min={1}
              max={40}
              step={1}
              aria-label="Pregnancy week"
            />

            <Button asChild className="w-full rounded-2xl shadow-soft">
              <Link href="/planner">
                Continue to today's plan
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>

        {/* Baby fun fact */}
        <Card className="border-accent/20 bg-accent-soft/40 p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card text-xl">
              {baby.emoji}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-accent-foreground/70">
                Week {week} · Baby this week
              </p>
              <p className="mt-1 text-sm font-medium leading-snug">
                Your baby is the size of a <span className="text-accent">{baby.size}</span>.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{baby.fact}</p>
            </div>
          </div>
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <QuickAction to="/symptoms" icon={Activity} label="Check symptoms" tone="rose" />
          <QuickAction to="/chat" icon={Sparkles} label="Ask AI" tone="sage" />
          <QuickAction to="/reports" icon={Heart} label="Simplify report" tone="rose" />
          <QuickAction to="/postpartum" icon={Moon} label="Postpartum" tone="sage" />
        </div>

        {/* Daily snapshot */}
        <Card className="p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-sm font-semibold">Today's snapshot</p>
            <Link href="/planner" className="text-xs font-medium text-primary">
              View plan
            </Link>
          </div>
          <div className="space-y-3">
            <Stat icon={Droplets} label="Hydration" value="4 / 8 glasses" />
            <Stat icon={Moon} label="Sleep" value="7h 20m" />
            <Stat icon={Activity} label="Steps" value="3,420" />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  tone,
}: {
  to: "/symptoms" | "/chat" | "/reports" | "/postpartum";
  icon: typeof Heart;
  label: string;
  tone: "rose" | "sage";
}) {
  return (
    <Link
      href={to}
      className="group rounded-2xl border border-border/60 bg-card p-3.5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card"
    >
      <span
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
          tone === "rose" ? "bg-primary-soft text-primary" : "bg-accent-soft text-accent"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium leading-tight">{label}</p>
    </Link>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Heart; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
