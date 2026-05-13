"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  Baby,
  Smile,
  AlertTriangle,
  MessageCircle,
  Phone,
  Moon,
  Activity,
  ChevronRight,
  UserCircle,
  CalendarClock,
  Sparkles,
  Heart,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import type { ProfileBundle } from "@/app/profile/profile-types";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { SmartHealthNudge } from "@/components/app/smart-health-nudge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PostpartumInsightsPayload } from "@/lib/postpartum/ai-insights";
import { postpartumWeekFromBirth } from "@/lib/pregnancy";
import { cn } from "@/lib/utils";

const MOODS = [
  { key: "happy", label: "Happy", emoji: "😊" },
  { key: "okay", label: "Okay", emoji: "🙂" },
  { key: "tired", label: "Tired", emoji: "😴" },
  { key: "stressed", label: "Stressed", emoji: "😟" },
  { key: "overwhelmed", label: "Overwhelmed", emoji: "😢" },
] as const;

type CheckInItem = {
  id: string;
  moodKey: string;
  note: string | null;
  loggedAt: string;
};

function recoveryTip(week: number | null): string {
  if (week == null) return "Once your birth date is saved, we can tailor reminders to your week.";
  if (week <= 2)
    return "Priority: rest, fluids, and gentle movement. Bleeding and cramps should slowly ease — call your clinician if they worsen.";
  if (week <= 6)
    return "Most physical healing happens in the first six weeks. Pace outings and accept help with meals and laundry.";
  if (week <= 12)
    return "Energy often creeps back — still guard sleep when you can, and keep follow-up appointments.";
  return "You are past the early weeks — keep checking in with your body and your care team about mood, contraception, and activity.";
}

/** First 1–2 sentences from AI recovery copy for compact UI. */
function sentencesFromText(text: string, maxSentences: number): string {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(0, maxSentences).join(" ");
}

export function PostpartumPageClient({ initialBundle }: { initialBundle: ProfileBundle }) {
  const [bundle, setBundle] = useState(initialBundle);
  const [mood, setMood] = useState<string | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInItem[]>([]);
  const [insights, setInsights] = useState<PostpartumInsightsPayload | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [moodSaving, setMoodSaving] = useState(false);
  const [mainTab, setMainTab] = useState("overview");

  useEffect(() => {
    setBundle(initialBundle);
  }, [initialBundle]);

  const loadCheckIns = useCallback(async () => {
    try {
      const res = await fetch("/api/wellbeing/check-in?context=postpartum&limit=14", {
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as {
        items?: { id: string; moodKey: string; note: string | null; loggedAt: string }[];
      };
      if (!res.ok) return;
      const items = (j.items ?? []).map((r) => ({
        id: r.id,
        moodKey: r.moodKey,
        note: r.note,
        loggedAt: r.loggedAt,
      }));
      setCheckIns(items);
      if (items[0]?.moodKey) setMood(items[0].moodKey);
    } catch {
      /* ignore */
    }
  }, []);

  const loadInsights = useCallback(async (opts?: { refresh?: boolean }) => {
    setInsightsLoading(true);
    try {
      const url = opts?.refresh ? "/api/postpartum/insights?refresh=1" : "/api/postpartum/insights";
      const res = await fetch(url, { credentials: "include", cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as PostpartumInsightsPayload & { message?: string };
      if (!res.ok) {
        setInsights(null);
        return;
      }
      setInsights({
        recovery: j.recovery,
        feeding: j.feeding,
        moodSupport: j.moodSupport,
        whenToSeekCare: j.whenToSeekCare,
        source: j.source === "fallback" ? "fallback" : "ai",
      });
    } catch {
      setInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCheckIns();
    void loadInsights();
  }, [loadCheckIns, loadInsights]);

  const birthRaw = bundle?.pregnancy?.baby_birth_date ?? null;
  const ppWeek = postpartumWeekFromBirth(birthRaw);
  const birthLabel =
    birthRaw && !Number.isNaN(new Date(birthRaw.slice(0, 10)).getTime())
      ? new Date(birthRaw.slice(0, 10)).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  const heroRecoveryLine = useMemo(() => {
    if (insights && !insightsLoading && insights.recovery.trim()) {
      return sentencesFromText(insights.recovery, 1);
    }
    return recoveryTip(ppWeek);
  }, [insights, insightsLoading, ppWeek]);

  const todaysFocusBody = useMemo(() => {
    if (insights && !insightsLoading && insights.recovery.trim()) {
      return sentencesFromText(insights.recovery, 2);
    }
    return recoveryTip(ppWeek);
  }, [insights, insightsLoading, ppWeek]);

  async function submitMood(key: string) {
    if (moodSaving) return;
    setMoodSaving(true);
    setMood(key);
    try {
      const res = await fetch("/api/wellbeing/check-in", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: "postpartum", moodKey: key }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        item?: { id: string; moodKey: string; note: string | null; loggedAt: string };
        message?: string;
      };
      if (!res.ok || !j.item) throw new Error(j.message ?? "Could not save check-in");
      setCheckIns((prev) => [
        { id: j.item!.id, moodKey: j.item!.moodKey, note: j.item!.note, loggedAt: j.item!.loggedAt },
        ...prev.filter((x) => x.id !== j.item!.id),
      ]);
      toast.success("Saved your check-in");
      void loadInsights();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save check-in");
    } finally {
      setMoodSaving(false);
    }
  }

  return (
    <AppShell>
      <AppHeader title="Postpartum support" showBack />
      <div className="space-y-5 px-4 pt-4 pb-24">
        <SmartHealthNudge />

        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-muted/70 p-1">
            <TabsTrigger value="overview" className="rounded-xl text-xs sm:text-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="ai" className="rounded-xl text-xs sm:text-sm">
              AI coach
            </TabsTrigger>
            <TabsTrigger value="care" className="rounded-xl text-xs sm:text-sm">
              Care tips
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-5">
            <Card className="overflow-hidden border-0 bg-gradient-warm p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">Recovery</p>
              {ppWeek != null ? (
                <>
                  <p className="font-display text-3xl font-semibold">
                    Week {ppWeek}
                    <span className="text-lg font-medium text-muted-foreground"> /52</span>
                  </p>
                  {birthLabel ? <p className="text-sm text-muted-foreground">Born {birthLabel}</p> : null}
                  <div className="mt-3 flex gap-1.5">
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
                  <p className="mt-3 text-xs text-muted-foreground">{heroRecoveryLine}</p>
                </>
              ) : (
                <>
                  <p className="font-display text-xl font-semibold leading-tight">Add your baby&apos;s birth date</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We use it to show your postpartum week on Home and here. You can update it anytime.
                  </p>
                  <Button asChild className="mt-4 w-full rounded-2xl">
                    <Link href="/profile/edit" prefetch>
                      Open profile editor
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </>
              )}
            </Card>

            {ppWeek != null ? (
              <Card className="border-primary/15 bg-gradient-to-br from-primary-soft/40 to-card p-4 shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">Today&apos;s focus</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">{todaysFocusBody}</p>
                {insights && !insightsLoading ? (
                  <Button
                    type="button"
                    variant="link"
                    className="mt-1 h-auto px-0 py-1 text-sm font-semibold text-primary"
                    onClick={() => setMainTab("ai")}
                  >
                    More in AI coach
                    <ChevronRight className="ml-0.5 h-4 w-4" />
                  </Button>
                ) : null}
              </Card>
            ) : null}

            <Card className="p-4 shadow-soft">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Smile className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-base font-semibold">How are you feeling?</h2>
                  <p className="text-xs text-muted-foreground">Private check-in — not sent to your clinic</p>
                </div>
              </div>
              <div className="flex flex-wrap justify-between gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    disabled={moodSaving}
                    onClick={() => void submitMood(m.key)}
                    className={cn(
                      "flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-medium transition-all",
                      mood === m.key
                        ? "border-primary bg-primary-soft"
                        : "border-border hover:border-primary/40",
                      moodSaving && "opacity-60",
                    )}
                  >
                    <span className="text-2xl">{m.emoji}</span>
                    {m.label}
                  </button>
                ))}
              </div>
              {moodSaving ? (
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Saving…
                </p>
              ) : null}
            </Card>

            {checkIns.length > 0 ? (
              <Card className="p-4 shadow-soft">
                <h3 className="mb-3 font-display text-sm font-semibold">Recent check-ins</h3>
                <ul className="flex flex-wrap gap-2">
                  {checkIns.slice(0, 10).map((c) => {
                    const label = MOODS.find((x) => x.key === c.moodKey)?.label ?? c.moodKey;
                    return (
                      <li
                        key={c.id}
                        className="rounded-full border border-border/80 bg-muted/50 px-3 py-1 text-[11px] text-foreground"
                      >
                        <span className="font-medium">{label}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {formatDistanceToNow(new Date(c.loggedAt), { addSuffix: true })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Button asChild variant="outline" className="h-auto flex-col gap-1 rounded-2xl py-4">
                <Link href="/chat" prefetch>
                  <Sparkles className="h-5 w-5" />
                  <span>Ask AI</span>
                </Link>
              </Button>
              <Button asChild className="h-auto flex-col gap-1 rounded-2xl py-4">
                <Link href="/emergency" prefetch>
                  <Phone className="h-5 w-5" />
                  <span>Emergency</span>
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-auto flex-col gap-1 rounded-2xl py-4">
                <Link href="/symptoms" prefetch>
                  <MessageCircle className="h-5 w-5" />
                  <span>Symptoms</span>
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-auto flex-col gap-1 rounded-2xl py-4">
                <Link href="/planner" prefetch>
                  <CalendarClock className="h-5 w-5" />
                  <span>Planner</span>
                </Link>
              </Button>
            </div>

            <Button asChild variant="ghost" className="w-full rounded-2xl text-muted-foreground">
              <Link href="/profile/edit" prefetch>
                <UserCircle className="mr-2 h-4 w-4" />
                Update pregnancy & birth date
              </Link>
            </Button>
          </TabsContent>

          <TabsContent value="ai" className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Personalized guidance from MaaCare (not a substitute for your clinician). Refreshes when you log a new
              mood.
            </p>
            {insightsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                ))}
              </div>
            ) : insights ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {insights.source === "ai" ? "AI insight pack" : "Offline tips"}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => void loadInsights({ refresh: true })}
                  >
                    Refresh
                  </Button>
                </div>
                <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] to-card p-4 shadow-soft">
                  <div className="mb-2 flex items-center gap-2 text-violet-700 dark:text-violet-200">
                    <Activity className="h-4 w-4" />
                    <h3 className="font-display text-sm font-semibold">Recovery</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{insights.recovery}</p>
                </Card>
                <Card className="border-sky-500/20 bg-gradient-to-br from-sky-500/[0.06] to-card p-4 shadow-soft">
                  <div className="mb-2 flex items-center gap-2 text-sky-800 dark:text-sky-100">
                    <Baby className="h-4 w-4" />
                    <h3 className="font-display text-sm font-semibold">Feeding</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{insights.feeding}</p>
                </Card>
                <Card className="border-primary/20 bg-gradient-to-br from-primary-soft/50 to-card p-4 shadow-soft">
                  <div className="mb-2 flex items-center gap-2 text-primary">
                    <Heart className="h-4 w-4" />
                    <h3 className="font-display text-sm font-semibold">Mood & support</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{insights.moodSupport}</p>
                </Card>
                <Card className="border-risk-medium/30 bg-risk-medium/15 p-4 shadow-soft">
                  <div className="mb-2 flex items-center gap-2 text-risk-medium-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    <h3 className="font-display text-sm font-semibold">When to seek care</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-risk-medium-foreground/95">{insights.whenToSeekCare}</p>
                </Card>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Could not load AI coach right now. Try again in a moment.</p>
            )}
          </TabsContent>

          <TabsContent value="care" className="mt-4 space-y-5">
            {insightsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-36 w-full rounded-2xl" />
                ))}
              </div>
            ) : insights ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Personalized care tips from your latest coach insight. Open{" "}
                  <button
                    type="button"
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                    onClick={() => setMainTab("ai")}
                  >
                    AI coach
                  </button>{" "}
                  for the full pack.
                </p>
                <Card className="p-4 shadow-soft">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <Moon className="h-5 w-5" />
                    </span>
                    <h2 className="font-display text-base font-semibold">Recovery & rest</h2>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{insights.recovery}</p>
                </Card>
                <Card className="p-4 shadow-soft">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Baby className="h-5 w-5" />
                    </span>
                    <h2 className="font-display text-base font-semibold">Feeding</h2>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{insights.feeding}</p>
                </Card>
                <Card className="p-4 shadow-soft">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Heart className="h-5 w-5" />
                    </span>
                    <h2 className="font-display text-base font-semibold">Mood & support</h2>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{insights.moodSupport}</p>
                </Card>
                <Card className="border-risk-medium/30 bg-risk-medium/15 p-4 shadow-soft">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-risk-medium-foreground">
                      <AlertTriangle className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-semibold text-risk-medium-foreground">
                        When to seek care
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-risk-medium-foreground/95">
                        {insights.whenToSeekCare}
                      </p>
                      <Button asChild size="sm" className="mt-3 rounded-xl">
                        <Link href="/emergency" prefetch>
                          Emergency & hospitals
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Card>
                <Button asChild variant="secondary" className="w-full rounded-2xl">
                  <Link href="/vitals" prefetch>
                    Open vitals
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Card className="p-4 shadow-soft">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <Moon className="h-5 w-5" />
                    </span>
                    <h2 className="font-display text-base font-semibold">Sleep & rest</h2>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="rounded-xl bg-muted/60 p-2.5 text-foreground">
                      Sleep when the baby sleeps when you can — short naps add up.
                    </li>
                    <li className="rounded-xl bg-muted/60 p-2.5 text-foreground">
                      Limit visitors if you feel drained; it is okay to protect quiet time.
                    </li>
                  </ul>
                </Card>

                <Card className="p-4 shadow-soft">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Baby className="h-5 w-5" />
                    </span>
                    <h2 className="font-display text-base font-semibold">Feeding</h2>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="rounded-xl bg-muted/60 p-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Breastfeeding
                      </p>
                      <p className="mt-0.5 text-foreground">Feed every 2–3 hours early on; drink water with feeds.</p>
                    </li>
                    <li className="rounded-xl bg-muted/60 p-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formula</p>
                      <p className="mt-0.5 text-foreground">
                        Follow safe prep and hygiene; your pediatrician can adjust volumes.
                      </p>
                    </li>
                  </ul>
                </Card>

                <Card className="p-4 shadow-soft">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Activity className="h-5 w-5" />
                    </span>
                    <h2 className="font-display text-base font-semibold">Body & movement</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Gentle walks are usually fine once your clinician clears you. Avoid heavy lifting until you are
                    healed. Log vitals in the app if your team asked you to track blood pressure or temperature.
                  </p>
                  <Button asChild variant="secondary" className="mt-3 w-full rounded-2xl">
                    <Link href="/vitals" prefetch>
                      Open vitals
                    </Link>
                  </Button>
                </Card>

                <Card className="border-risk-high/35 bg-risk-high/15 p-4 shadow-soft">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-risk-high">
                      <AlertTriangle className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-semibold text-risk-high">Seek urgent care if you have</h3>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed text-risk-high/95">
                        <li>Heavy bleeding (soaking a pad in an hour) or large clots</li>
                        <li>Fever 38 °C (100.4 °F) or higher</li>
                        <li>Severe headache with vision changes, or chest pain / breathlessness</li>
                        <li>Thoughts of hurting yourself or the baby — get help immediately</li>
                      </ul>
                      <Button asChild size="sm" className="mt-3 rounded-xl">
                        <Link href="/emergency" prefetch>
                          Emergency & hospitals
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="border-risk-medium/40 bg-risk-medium/40 p-4 shadow-soft">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-risk-medium-foreground">
                      <AlertTriangle className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-semibold text-risk-medium-foreground">
                        Emotional health matters
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-risk-medium-foreground/90">
                        Baby blues are common; if low mood, anxiety, or disconnection lasts more than two weeks, tell a
                        clinician. You are not failing — support works.
                      </p>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
