"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

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
  if (w != null && w >= 0 && w <= 42) return "pregnant";
  return "planning";
}

export function HomeClient({ initial }: { initial: HomeData }) {
  const { t } = useTranslation("home");
  const router = useRouter();
  const [home, setHome] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);

  const stage = useMemo(() => homeJourneyStage(home.pregnancy), [home.pregnancy]);
  const displayWeek = useMemo(() => {
    const w = coerceGestationalWeek(home.pregnancy.gestationalWeek);
    if (w == null) return null;
    if (w < 0 || w > 42) return null;
    return Math.max(1, Math.min(40, Math.round(w)));
  }, [home.pregnancy.gestationalWeek]);
  const baby = useMemo(
    () => (displayWeek != null ? babyAt(displayWeek) : null),
    [displayWeek],
  );
  const trimester = useMemo(
    () => (displayWeek != null ? trimesterOf(displayWeek) : null),
    [displayWeek],
  );
  const ppWeek = home.pregnancy.postpartumWeek;

  async function refreshHomeData() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/app/home", { credentials: "include", cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as HomeData & { message?: string; error?: string };
      if (!res.ok) throw new Error(j.message ?? j.error ?? t("toastRefreshError"));
      setHome(j);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toastRefreshError"));
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

      <div className="space-y-5 px-0 pt-4">
        <SmartHealthNudge />
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {t("welcomeBack", { name: home.profile.displayName || t("memberFallback") })}
          </p>
          <h1 className="font-display text-2xl font-semibold leading-tight text-balance">
            {t("greetingTitle")}
          </h1>
        </motion.div>

        {home.care.viewingSubjectUserId ? (
          <div className="rounded-3xl bg-muted/35 px-4 py-2.5 text-center text-xs text-muted-foreground">
            {t("careLinked")}
            {home.care.viewingSubjectDisplayName ? ` · ${home.care.viewingSubjectDisplayName}` : ""}
          </div>
        ) : null}

        {home.ui.showPregnancyJourney ? (
          <>
            {stage === "planning" ? (
          <Card className="overflow-hidden border-0 bg-gradient-hero p-0 shadow-card">
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
                    {t("planningJourneyEyebrow")}
                  </p>
                  <p className="font-display text-4xl font-semibold leading-none tracking-tight">{t("planningTitle")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("planningSubtitle")}</p>
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("hydration")}
                  </p>
                  <p className="mt-0.5 font-display text-base font-semibold leading-none">8</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("glassesPerDay")}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-soft">
                  <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Activity className="h-5 w-5" />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("movement")}
                  </p>
                  <p className="mt-0.5 font-display text-base font-semibold leading-none">20</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("minsPerDay")}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-soft">
                  <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <CalendarClock className="h-5 w-5" />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("checkup")}
                  </p>
                  <p className="mt-0.5 font-display text-base font-semibold leading-none">{t("checkupPlanValue")}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("whenReady")}</p>
                </div>
              </div>
              <Button asChild className="w-full rounded-2xl">
                <Link href="/planner">
                  {t("openYourPlanner")}
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
                    {t("postpartumEyebrow")}
                  </p>
                  <p className="font-display text-4xl font-semibold leading-none tracking-tight">
                    {ppWeek != null ? (
                      <>
                        {t("postpartumWeekLine", { week: ppWeek })}
                        <span className="text-lg font-medium text-muted-foreground">{t("postpartumWeekSlash")}</span>
                      </>
                    ) : (
                      <span className="text-2xl">{t("setBirthDate")}</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ppWeek != null ? t("postpartumSubtitle") : t("postpartumNoDateSubtitle")}
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
                <p className="text-[11px] text-muted-foreground">{t("barsHint")}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="secondary" className="rounded-2xl">
                  <Link href="/profile/edit">{t("addBirthDate")}</Link>
                </Button>
                <Button asChild className="rounded-2xl">
                  <Link href="/postpartum">
                    {t("postpartumHub")}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        ) : displayWeek == null ? (
          <Card className="overflow-hidden border-0 bg-gradient-hero p-0 shadow-card">
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
                    {t("pregnancyWeekEyebrow")}
                  </p>
                  <p className="font-display text-2xl font-semibold leading-tight tracking-tight">
                    {t("addYourDates")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("addYourDatesHelp")}</p>
                </div>
                <motion.div
                  initial={false}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-card text-5xl shadow-soft animate-float"
                >
                  <CalendarDays className="h-10 w-10 text-primary" aria-hidden />
                </motion.div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="secondary" className="rounded-2xl">
                  <Link href="/profile/edit">{t("editProfile")}</Link>
                </Button>
                <Button asChild className="rounded-2xl">
                  <Link href="/planner">
                    {t("openPlanner")}
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
                    {t("pregnancyWeekEyebrow")}
                  </p>
                  <p className="font-display text-4xl font-semibold leading-none tracking-tight">
                    {displayWeek}
                    <span className="text-lg font-medium text-muted-foreground">{t("weekSuffix40")}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("trimesterLine", { trimester, remaining: Math.max(0, 40 - displayWeek) })}
                    {home.pregnancy.displayEdd
                      ? t("dueDateSuffix", {
                          date: new Date(home.pregnancy.displayEdd).toLocaleDateString(),
                        })
                      : ""}
                  </p>
                </div>
                {baby ? (
                  <motion.div
                    key={baby.emoji}
                    initial={false}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-card text-5xl shadow-soft animate-float"
                  >
                    {baby.emoji}
                  </motion.div>
                ) : null}
              </div>

              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={displayWeek}
                aria-valuemin={1}
                aria-valuemax={40}
                aria-label={t("progressAria", { week: displayWeek })}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${Math.min(100, (displayWeek / 40) * 100)}%` }}
                />
              </div>

              <Button asChild className="w-full rounded-2xl">
                <Link href="/planner">
                  {t("continueTodayPlan")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
            )}
          </>
        ) : home.ui.showPartnerConnectHint ? (
          <Card className="overflow-hidden border-0 bg-gradient-hero p-0 shadow-sm">
            <div className="space-y-4 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">{t("familyCareEyebrow")}</p>
              <p className="font-display text-2xl font-semibold leading-tight">{t("familyCareTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("familyCareSubtitle")}</p>
              <Button asChild className="w-full rounded-2xl">
                <Link href="/profile/edit">{t("openProfileEditor")}</Link>
              </Button>
            </div>
          </Card>
        ) : home.ui.heroVariant === "student" ? (
          <Card className="overflow-hidden border-0 bg-gradient-hero p-0 shadow-sm">
            <div className="space-y-3 p-5">
              <p className="font-display text-2xl font-semibold">{t("studentHubTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("studentHubSubtitle")}</p>
              <Button asChild className="w-full rounded-2xl">
                <Link href="/planner">
                  {t("openPlanner")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        ) : home.ui.heroVariant === "clinician" ? (
          <Card className="overflow-hidden border-0 bg-gradient-hero p-0 shadow-sm">
            <div className="space-y-3 p-5">
              <p className="font-display text-2xl font-semibold">{t("clinicalTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("clinicalSubtitle")}</p>
              <Button asChild className="w-full rounded-2xl">
                <Link href="/chat">
                  {t("askAI")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden border-0 bg-gradient-hero p-0 shadow-sm">
            <div className="space-y-3 p-5">
              <p className="font-display text-2xl font-semibold">{t("welcomeCardTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("welcomeCardSubtitle")}</p>
              <Button asChild className="w-full rounded-2xl">
                <Link href="/planner">
                  {t("welcomeContinue")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        )}

        {home.ui.showVitalsCard ? (
        <Card className="p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-sm font-semibold">{t("vitalsSnapshot")}</p>
            <Link href="/vitals" className="text-xs font-medium text-primary">
              {t("openMonitor")}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <VisualVitalCard
              icon={Heart}
              label={t("heartRate")}
              value={home.vitals?.heart_rate_bpm != null ? `${home.vitals.heart_rate_bpm} bpm` : "—"}
              tone="rose"
              pulse
            />
            <VisualVitalCard
              icon={Activity}
              label={t("bloodPressure")}
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
              label={t("temperature")}
              value={home.vitals?.temperature_c != null ? `${home.vitals.temperature_c} °C` : "—"}
              tone="rose"
              floatY
            />
            <VisualVitalCard
              icon={Wind}
              label={t("spo2")}
              value={home.vitals?.spo2_pct != null ? `${home.vitals.spo2_pct}%` : "—"}
              tone="sage"
              breathe
            />
          </div>
        </Card>
        ) : null}

        {home.ui.showPregnancyJourney ? (
        <Card className="border-accent/20 bg-accent-soft/40 p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card text-xl">
              {stage === "planning" ? (
                <CalendarDays className="h-5 w-5 text-accent" aria-hidden />
              ) : stage === "postpartum" ? (
                <Moon className="h-5 w-5 text-accent" aria-hidden />
              ) : displayWeek == null ? (
                <CalendarDays className="h-5 w-5 text-accent" aria-hidden />
              ) : (
                baby?.emoji ?? null
              )}
            </span>
            <div>
              {stage === "planning" ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider">{t("planningFocusEyebrow")}</p>
                  <p className="mt-1 text-sm font-medium leading-snug">{t("planningFocusBody")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("planningFocusMeta")}</p>
                </>
              ) : stage === "postpartum" ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    {ppWeek != null ? t("postpartumRecoveryEyebrow", { week: ppWeek }) : t("postpartumRecoveryEyebrowGeneric")}
                  </p>
                  <p className="mt-1 text-sm font-medium leading-snug">{t("postpartumRecoveryBody")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("postpartumRecoveryMeta")}</p>
                </>
              ) : displayWeek == null ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider">{t("pregnancyDetailsEyebrow")}</p>
                  <p className="mt-1 text-sm font-medium leading-snug">{t("pregnancyDetailsBody")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <Link href="/profile/edit" className="font-medium text-primary underline-offset-2 hover:underline">
                      {t("openProfileEditorLink")}
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    {t("weekBabyEyebrow", { week: displayWeek })}
                  </p>
                  <p className="mt-1 text-sm font-medium leading-snug ">
                    {t("babySizeLine", {
                      who: home.care.viewingSubjectUserId ? t("babyTheir") : t("babyYour"),
                      size: baby?.size ?? "—",
                    })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{baby?.fact ?? ""}</p>
                </>
              )}
            </div>
          </div>
        </Card>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {home.ui.showSymptomShortcut ? (
            <QuickAction to="/symptoms" icon={Activity} label={t("checkSymptoms")} tone="rose" />
          ) : null}
          <QuickAction to="/chat" icon={Sparkles} label={t("askAILabel")} tone="sage" />
          <QuickAction to="/reports" icon={Heart} label={t("simplifyReport")} tone="rose" />
          {home.ui.showPostpartumShortcut ? (
            <QuickAction
              to={stage === "pregnant" ? "/postpartum" : "/planner"}
              icon={stage === "pregnant" ? Moon : CalendarClock}
              label={stage === "pregnant" ? t("postpartumShort") : t("planner")}
              tone="sage"
            />
          ) : (
            <QuickAction to="/planner" icon={CalendarClock} label={t("planner")} tone="sage" />
          )}
        </div>

        <Card className="p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-sm font-semibold">{t("latestUpdates")}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void refreshHomeData()}
                disabled={refreshing}
                className="text-xs font-medium text-primary disabled:opacity-60"
              >
                {refreshing ? t("refreshingAction") : t("refreshAction")}
              </button>
              <Link href="/profile" className="text-xs font-medium text-primary">
                {t("viewProfile")}
              </Link>
            </div>
          </div>
          <div className="space-y-0.5">
            <TimelineItem
              icon={CalendarClock}
              title={t("nextAppointment")}
              href="/appointments"
              detail={
                home.upcomingAppointment ? `${home.upcomingAppointment.title}` : t("noUpcomingAppointment")
              }
              meta={
                home.upcomingAppointment
                  ? new Date(home.upcomingAppointment.scheduled_at).toLocaleString()
                  : t("addAppointmentMeta")
              }
            />
            <TimelineItem
              icon={Stethoscope}
              title={t("latestVitals")}
              href="/vitals"
              detail={
                home.vitals
                  ? [
                      home.vitals.systolic_bp && home.vitals.diastolic_bp
                        ? t("bpDetail", { sys: home.vitals.systolic_bp, dia: home.vitals.diastolic_bp })
                        : null,
                      home.vitals.heart_rate_bpm
                        ? t("hrDetail", { hr: home.vitals.heart_rate_bpm })
                        : null,
                      home.vitals.weight_kg != null ? t("wtDetail", { kg: home.vitals.weight_kg }) : null,
                      home.vitals.spo2_pct != null ? t("spo2Detail", { pct: home.vitals.spo2_pct }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || t("vitalsRecorded")
                  : t("noVitalsLogged")
              }
              meta={home.vitals ? new Date(home.vitals.recorded_at).toLocaleString() : t("logFirstVitals")}
            />
            <TimelineItem
              icon={Droplets}
              title={t("latestSymptomLog")}
              href={
                home.latestSymptom?.id
                  ? `/symptoms/result?logId=${encodeURIComponent(home.latestSymptom.id)}`
                  : "/symptoms"
              }
              detail={
                home.latestSymptom
                  ? t("symptomTitleSaved", {
                      title: home.latestSymptom.title || t("symptomCheckDefault"),
                    })
                  : t("noSymptomsLogged")
              }
              meta={
                home.latestSymptom
                  ? `${new Date(home.latestSymptom.logged_at).toLocaleString()}`
                  : t("logSymptomsInsight")
              }
              riskLevel={latestSymptomRisk}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Link
              href="/profile/edit"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent/80"
            >
              {t("updateHealth")}
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
  const { t } = useTranslation("home");
  const riskLabel =
    riskLevel === "low" ? t("risk_low") : riskLevel === "medium" ? t("risk_medium") : riskLevel === "high" ? t("risk_high") : null;
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
              {riskLabel}
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
