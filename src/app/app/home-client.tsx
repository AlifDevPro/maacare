"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  Thermometer,
  Wind,
  Flower2,
  Baby,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { SmartHealthNudge } from "@/components/app/smart-health-nudge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { babyAt, trimesterOf } from "@/lib/pregnancy";
import type { HomeData, JourneyStage } from "@/lib/app/home-types";
import { coerceGestationalWeek } from "@/lib/profile/computed";
import { cn } from "@/lib/utils";

/** Hero journey: match profile semantics — week can come from LMP/weeks even if status is still "planning". */
function homeJourneyStage(p: HomeData["pregnancy"]): JourneyStage {
  if (p.status === "postpartum") return "postpartum";
  if (p.status === "not_applicable") return "planning";
  if (p.status === "pregnant") return "pregnant";
  if (p.status === "planning") return "planning";
  const w = coerceGestationalWeek(p.gestationalWeek);
  if (w != null && w >= 1 && w <= 42) return "pregnant";
  return "planning";
}

export function HomeClient({ initial }: { initial: HomeData }) {
  const router = useRouter();
  const [home, setHome] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [week, setWeek] = useState(() => {
    const w = coerceGestationalWeek(initial.pregnancy.gestationalWeek);
    return w != null && w >= 1 ? Math.max(1, Math.min(40, Math.round(w))) : 20;
  });

  const stage = useMemo(() => homeJourneyStage(home.pregnancy), [home.pregnancy]);
  const baby = useMemo(() => babyAt(week), [week]);
  const trimester = useMemo(() => trimesterOf(week), [week]);
  const ppWeek = home.pregnancy.postpartumWeek;

  useEffect(() => {
    const w = coerceGestationalWeek(home.pregnancy.gestationalWeek);
    if (w != null && w >= 1) {
      setWeek(Math.max(1, Math.min(40, Math.round(w))));
    }
  }, [home.pregnancy.gestationalWeek, home.pregnancy.status]);

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

  async function refreshHomeData() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/app/home", { credentials: "include", cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as HomeData & { message?: string; error?: string };
      if (!res.ok) throw new Error(j.message ?? j.error ?? "Could not refresh updates");
      setHome(j);
      const w = coerceGestationalWeek(j.pregnancy?.gestationalWeek);
      if (w != null && w >= 1) {
        setWeek(Math.max(1, Math.min(40, Math.round(w))));
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not refresh updates");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const onFocus = () => void refreshHomeData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const latestSymptomRisk = (() => {
    const severity = home.latestSymptom?.severity;
    if (severity == null) return null;
    if (severity >= 7) return "high" as const;
    if (severity >= 4) return "medium" as const;
    return "low" as const;
  })();

  return (
    <AppShell>
      <AppHeader brand showNotifications />

      <div className="space-y-5 px-4 pt-4">
        <SmartHealthNudge />
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {`Welcome back, ${home.profile.displayName || "Member"}`}
          </p>
          <h1 className="font-display text-2xl font-semibold leading-tight text-balance">
            How are you feeling today?
          </h1>
        </motion.div>

        {stage === "planning" ? (
          <Card className="overflow-hidden border-0 bg-gradient-hero p-0 shadow-card">
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">Planning journey</p>
                  <p className="font-display text-4xl font-semibold leading-none tracking-tight">Get ready</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Build healthy routines before pregnancy — quick wins you can repeat daily.
                  </p>
                </div>
                <motion.div
                  initial={false}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-card text-5xl shadow-soft animate-float"
                >
                  <Flower2 className="h-10 w-10 text-primary" aria-hidden />
                </motion.div>
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className={cn("h-2 flex-1 rounded-full", i < 4 ? "bg-primary" : "bg-card")} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-soft">
                  <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Droplets className="h-5 w-5" />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hydration</p>
                  <p className="mt-0.5 font-display text-base font-semibold leading-none">8</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">glasses/day</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-soft">
                  <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Activity className="h-5 w-5" />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Movement</p>
                  <p className="mt-0.5 font-display text-base font-semibold leading-none">20</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">mins/day</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-soft">
                  <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <CalendarClock className="h-5 w-5" />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Check-up</p>
                  <p className="mt-0.5 font-display text-base font-semibold leading-none">Plan</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">when ready</p>
                </div>
              </div>
              <Button asChild className="w-full rounded-2xl">
                <Link href="/planner">
                  Open your planner
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        ) : stage === "postpartum" ? (
          <Card className="overflow-hidden border-0 bg-gradient-warm p-0 shadow-card">
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
                    Postpartum week
                  </p>
                  <p className="font-display text-4xl font-semibold leading-none tracking-tight">
                    {ppWeek != null ? (
                      <>
                        Week {ppWeek}
                        <span className="text-lg font-medium text-muted-foreground"> /52</span>
                      </>
                    ) : (
                      <span className="text-2xl">Set birth date</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ppWeek != null
                      ? "Fourth trimester — rest, nourish, and reach out when you need help."
                      : "Add your baby’s birth date under Profile → Pregnancy to see your week here."}
                  </p>
                </div>
                <motion.div
                  initial={false}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-card text-5xl shadow-soft animate-float"
                >
                  <Baby className="h-10 w-10 text-primary" aria-hidden />
                </motion.div>
              </div>
              {ppWeek != null ? (
                <div className="flex gap-1.5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-2 flex-1 rounded-full",
                        i < Math.min(ppWeek, 12) ? "bg-primary" : "bg-card",
                      )}
                    />
                  ))}
                </div>
              ) : null}
              {ppWeek != null ? (
                <p className="text-[11px] text-muted-foreground">Bars show your first 12 weeks after birth.</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="secondary" className="rounded-2xl">
                  <Link href="/profile/edit">Add birth date</Link>
                </Button>
                <Button asChild className="rounded-2xl">
                  <Link href="/postpartum">
                    Postpartum hub
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        ) : (
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
                    {home.pregnancy.displayEdd
                      ? ` · Due ${new Date(home.pregnancy.displayEdd).toLocaleDateString()}`
                      : ""}
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
                  Continue to today&apos;s plan
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-sm font-semibold">Vitals snapshot</p>
            <Link href="/vitals" className="text-xs font-medium text-primary">
              Open monitor
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <VisualVitalCard
              icon={Heart}
              label="Heart rate"
              value={home.vitals?.heart_rate_bpm != null ? `${home.vitals.heart_rate_bpm} bpm` : "—"}
              tone="rose"
              pulse
            />
            <VisualVitalCard
              icon={Activity}
              label="Blood pressure"
              value={
                home.vitals?.systolic_bp != null && home.vitals?.diastolic_bp != null
                  ? `${home.vitals.systolic_bp}/${home.vitals.diastolic_bp}`
                  : "—"
              }
              tone="sage"
              floatY
            />
            <VisualVitalCard
              icon={Thermometer}
              label="Temperature"
              value={home.vitals?.temperature_c != null ? `${home.vitals.temperature_c} °C` : "—"}
              tone="rose"
              floatY
            />
            <VisualVitalCard
              icon={Wind}
              label="SpO₂"
              value={home.vitals?.spo2_pct != null ? `${home.vitals.spo2_pct}%` : "—"}
              tone="sage"
              breathe
            />
          </div>
        </Card>

        <Card className="border-accent/20 bg-accent-soft/40 p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card text-xl">
              {stage === "planning" ? (
                <CalendarDays className="h-5 w-5 text-accent" aria-hidden />
              ) : stage === "postpartum" ? (
                <Moon className="h-5 w-5 text-accent" aria-hidden />
              ) : (
                baby.emoji
              )}
            </span>
            <div>
              {stage === "planning" ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider">Planning focus</p>
                  <p className="mt-1 text-sm font-medium leading-snug">
                    Gentle movement, balanced meals, and sleep set the tone before conception.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Log vitals regularly so your care team can spot trends early.
                  </p>
                </>
              ) : stage === "postpartum" ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    {ppWeek != null ? `Week ${ppWeek} · Recovery` : "Fourth trimester"}
                  </p>
                  <p className="mt-1 text-sm font-medium leading-snug">
                    Healing, feeding, and sleep are all normal challenges — pace yourself and ask for support.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Heavy bleeding, fever, or severe pain need urgent care — see Emergency if unsure.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    Week {week} · Baby this week
                  </p>
                  <p className="mt-1 text-sm font-medium leading-snug ">
                    Your baby is the size of a <span className="text-accent">{baby.size}</span>.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{baby.fact}</p>
                </>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <QuickAction to="/symptoms" icon={Activity} label="Check symptoms" tone="rose" />
          <QuickAction to="/chat" icon={Sparkles} label="Ask AI" tone="sage" />
          <QuickAction to="/reports" icon={Heart} label="Simplify report" tone="rose" />
          <QuickAction
            to={stage === "pregnant" ? "/postpartum" : "/planner"}
            icon={stage === "pregnant" ? Moon : CalendarClock}
            label={stage === "pregnant" ? "Postpartum" : "Planner"}
            tone="sage"
          />
        </div>

        <Card className="p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-sm font-semibold">Your latest updates</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void refreshHomeData()}
                disabled={refreshing}
                className="text-xs font-medium text-primary disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <Link href="/profile" className="text-xs font-medium text-primary">
                View profile
              </Link>
            </div>
          </div>
          <div className="space-y-0.5">
            <TimelineItem
              icon={CalendarClock}
              title="Next appointment"
              href="/appointments"
              detail={
                home.upcomingAppointment
                  ? `${home.upcomingAppointment.title}`
                  : "No upcoming appointment"
              }
              meta={
                home.upcomingAppointment
                  ? new Date(home.upcomingAppointment.scheduled_at).toLocaleString()
                  : "Add one to stay on schedule"
              }
            />
            <TimelineItem
              icon={Stethoscope}
              title="Latest vitals"
              href="/vitals"
              detail={
                home.vitals
                  ? [
                      home.vitals.systolic_bp && home.vitals.diastolic_bp
                        ? `BP ${home.vitals.systolic_bp}/${home.vitals.diastolic_bp}`
                        : null,
                      home.vitals.heart_rate_bpm ? `HR ${home.vitals.heart_rate_bpm}` : null,
                      home.vitals.weight_kg != null ? `Wt ${home.vitals.weight_kg}kg` : null,
                      home.vitals.spo2_pct != null ? `SpO₂ ${home.vitals.spo2_pct}%` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Vitals recorded"
                  : "No vitals logged yet"
              }
              meta={home.vitals ? new Date(home.vitals.recorded_at).toLocaleString() : "Log your first vitals"}
            />
            <TimelineItem
              icon={Droplets}
              title="Latest symptom log"
              href={
                home.latestSymptom?.id
                  ? `/symptoms/result?logId=${encodeURIComponent(home.latestSymptom.id)}`
                  : "/symptoms"
              }
              detail={home.latestSymptom ? `${home.latestSymptom.title || "Symptom check"} saved` : "No symptoms logged yet"}
              meta={
                home.latestSymptom
                  ? `${new Date(home.latestSymptom.logged_at).toLocaleString()}`
                  : "Log symptoms for AI insight"
              }
              riskLevel={latestSymptomRisk}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Link
              href="/profile/edit"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent/80"
            >
              Update health
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function VisualVitalCard({
  icon: Icon,
  label,
  value,
  tone,
  pulse,
  floatY,
  breathe,
}: {
  icon: typeof Heart;
  label: string;
  value: string;
  tone: "rose" | "sage";
  pulse?: boolean;
  floatY?: boolean;
  breathe?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <motion.span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            tone === "rose" ? "bg-primary-soft text-primary" : "bg-accent-soft text-accent",
          )}
          animate={
            pulse
              ? { scale: [1, 1.08, 1] }
              : floatY
                ? { y: [0, -2, 0] }
                : breathe
                  ? { opacity: [0.75, 1, 0.75] }
                  : undefined
          }
          transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon className={cn("h-4 w-4", pulse && "fill-current")} />
        </motion.span>
        {pulse ? (
          <svg viewBox="0 0 100 24" className="h-5 w-16 text-primary/60">
            <motion.polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              points="0,12 12,12 20,4 30,20 40,8 52,12 100,12"
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </svg>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-display text-base font-semibold">{value}</p>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  tone,
}: {
  to: "/symptoms" | "/chat" | "/reports" | "/postpartum" | "/planner";
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

function TimelineItem({
  icon: Icon,
  title,
  detail,
  meta,
  href,
  riskLevel,
}: {
  icon: typeof Heart;
  title: string;
  detail: string;
  meta: string;
  href?: string;
  riskLevel?: "low" | "medium" | "high" | null;
}) {
  const body = (
    <div className="relative py-2.5 pl-11">
      <span className="absolute left-[15px] top-0 h-full w-px bg-border/70" />
      <span className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 rounded-xl border border-border/60 bg-card px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {riskLevel ? (
            <span
              className={cn(
                "rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                riskLevel === "low" && "bg-risk-low text-risk-low-foreground",
                riskLevel === "medium" && "bg-risk-medium text-risk-medium-foreground",
                riskLevel === "high" && "bg-risk-high text-risk-high-foreground",
              )}
            >
              {riskLevel} risk
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 break-words text-sm font-medium text-foreground/90">{detail}</p>
        <p className="mt-1 break-words text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
      {body}
    </Link>
  );
}
