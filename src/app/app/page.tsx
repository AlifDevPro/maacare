"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { motion } from "framer-motion";
import {
  Heart,
  Sparkles,
  Droplets,
  Moon,
  Activity,
  ChevronRight,
  CalendarClock,
  Stethoscope,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { babyAt, trimesterOf } from "@/lib/pregnancy";
import { toast } from "sonner";

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>("Member");
  const [week, setWeek] = useState(20);
  const [edd, setEdd] = useState<string | null>(null);

  const [upcomingAppointment, setUpcomingAppointment] = useState<{
    id: string;
    title: string;
    scheduled_at: string;
    provider_name: string | null;
    location: string | null;
    appointment_type: string | null;
  } | null>(null);

  const [latestVitals, setLatestVitals] = useState<{
    recorded_at: string;
    systolic_bp: number | null;
    diastolic_bp: number | null;
    heart_rate_bpm: number | null;
    weight_kg: number | null;
    temperature_c: number | null;
    glucose_mg_dl: number | null;
    spo2_pct: number | null;
  } | null>(null);

  const [latestSymptom, setLatestSymptom] = useState<{
    logged_at: string;
    title: string | null;
    severity: number | null;
  } | null>(null);

  const baby = useMemo(() => babyAt(week), [week]);
  const trimester = useMemo(() => trimesterOf(week), [week]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/app/home", { credentials: "include" });
        const j = (await res.json().catch(() => ({}))) as {
          profile?: { displayName?: string };
          pregnancy?: { gestationalWeek?: number | null; displayEdd?: string | null };
          upcomingAppointment?: HomePage["upcomingAppointment"];
          vitals?: HomePage["latestVitals"];
          latestSymptom?: HomePage["latestSymptom"];
          error?: string;
          message?: string;
        };
        if (!res.ok) throw new Error(j.message ?? j.error ?? "Could not load home data");
        if (!alive) return;
        setDisplayName(j.profile?.displayName?.trim() || "Member");
        if (typeof j.pregnancy?.gestationalWeek === "number" && j.pregnancy.gestationalWeek >= 1) {
          setWeek(Math.max(1, Math.min(40, Math.round(j.pregnancy.gestationalWeek))));
        }
        setEdd(j.pregnancy?.displayEdd ?? null);
        setUpcomingAppointment((j.upcomingAppointment as any) ?? null);
        setLatestVitals((j.vitals as any) ?? null);
        setLatestSymptom((j.latestSymptom as any) ?? null);
      } catch (e) {
        if (alive) toast.error(e instanceof Error ? e.message : "Could not load home");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  async function persistWeek(nextWeek: number) {
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gestationalAgeWeeks: nextWeek }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not save pregnancy week");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save pregnancy week");
    }
  }

  return (
    <AppShell>
      <AppHeader brand showNotifications />

      <div className="space-y-5 px-4 pt-4">
        {/* Hero greeting — initial=false avoids invisible-first-frame issues on some mobile WebViews */}
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {loading ? "Welcome back" : `Welcome back, ${displayName}`}
          </p>
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
                  Trimester {trimester} · {Math.max(0, 40 - week)} weeks to go
                  {edd ? ` · Due ${new Date(edd).toLocaleDateString()}` : ""}
                </p>
              </div>
              <motion.div
                key={baby.emoji}
                initial={false}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-card text-5xl shadow-soft animate-float"
              >
                {baby.emoji}
              </motion.div>
            </div>

            <Slider
              value={[week]}
              onValueChange={([v]) => setWeek(v)}
              onValueCommit={([v]) => void persistWeek(v)}
              min={1}
              max={40}
              step={1}
              aria-label="Pregnancy week"
            />

            <Button asChild className="w-full rounded-2xl">
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
              <p className="text-xs font-semibold uppercase tracking-wider">
                Week {week} · Baby this week
              </p>
              <p className="mt-1 text-sm font-medium leading-snug ">
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

        {/* Live snapshot (database) */}
        <Card className="p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-sm font-semibold">Your latest updates</p>
            <Link href="/profile" className="text-xs font-medium text-primary">
              View profile
            </Link>
          </div>
          <div className="space-y-3">
            <Stat
              icon={CalendarClock}
              label="Next appointment"
              value={
                upcomingAppointment
                  ? `${upcomingAppointment.title} · ${new Date(upcomingAppointment.scheduled_at).toLocaleString()}`
                  : "No upcoming appointment"
              }
            />
            <Stat
              icon={Stethoscope}
              label="Latest vitals"
              value={
                latestVitals
                  ? [
                      latestVitals.systolic_bp && latestVitals.diastolic_bp
                        ? `BP ${latestVitals.systolic_bp}/${latestVitals.diastolic_bp}`
                        : null,
                      latestVitals.heart_rate_bpm ? `HR ${latestVitals.heart_rate_bpm}` : null,
                      latestVitals.weight_kg != null ? `Wt ${latestVitals.weight_kg}kg` : null,
                      latestVitals.spo2_pct != null ? `SpO₂ ${latestVitals.spo2_pct}%` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || `Recorded ${new Date(latestVitals.recorded_at).toLocaleString()}`
                  : "No vitals logged yet"
              }
            />
            <Stat
              icon={Droplets}
              label="Latest symptom log"
              value={
                latestSymptom
                  ? `${latestSymptom.title || "Symptom"}${
                      latestSymptom.severity != null ? ` · Severity ${latestSymptom.severity}/10` : ""
                    } · ${new Date(latestSymptom.logged_at).toLocaleString()}`
                  : "No symptoms logged yet"
              }
            />
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
