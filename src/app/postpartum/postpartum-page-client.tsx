"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";

import type { ProfileBundle } from "@/app/profile/profile-types";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { postpartumWeekFromBirth } from "@/lib/pregnancy";
import { cn } from "@/lib/utils";

const MOODS = [
  { key: "happy", label: "Happy", emoji: "😊" },
  { key: "okay", label: "Okay", emoji: "🙂" },
  { key: "tired", label: "Tired", emoji: "😴" },
  { key: "stressed", label: "Stressed", emoji: "😟" },
  { key: "overwhelmed", label: "Overwhelmed", emoji: "😢" },
] as const;

function recoveryTip(week: number | null): string {
  if (week == null) return "Once your birth date is saved, we can tailor reminders to your week.";
  if (week <= 2) return "Priority: rest, fluids, and gentle movement. Bleeding and cramps should slowly ease — call your clinician if they worsen.";
  if (week <= 6) return "Most physical healing happens in the first six weeks. Pace outings and accept help with meals and laundry.";
  if (week <= 12) return "Energy often creeps back — still guard sleep when you can, and keep follow-up appointments.";
  return "You are past the early weeks — keep checking in with your body and your care team about mood, contraception, and activity.";
}

export function PostpartumPageClient({ initialBundle }: { initialBundle: ProfileBundle }) {
  const [bundle, setBundle] = useState(initialBundle);
  const [mood, setMood] = useState<string | null>(null);

  useEffect(() => {
    setBundle(initialBundle);
  }, [initialBundle]);

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

  return (
    <AppShell>
      <AppHeader title="Postpartum support" showBack />
      <div className="space-y-5 px-4 pt-4 pb-24">
            <Card className="overflow-hidden border-0 bg-gradient-warm p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">Recovery</p>
              {ppWeek != null ? (
                <>
                  <p className="font-display text-3xl font-semibold">
                    Week {ppWeek}
                    <span className="text-lg font-medium text-muted-foreground"> /52</span>
                  </p>
                  {birthLabel ? (
                    <p className="text-sm text-muted-foreground">Born {birthLabel}</p>
                  ) : null}
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
                  <p className="mt-3 text-xs text-muted-foreground">{recoveryTip(ppWeek)}</p>
                </>
              ) : (
                <>
                  <p className="font-display text-xl font-semibold leading-tight">Add your baby&apos;s birth date</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We use it to show your postpartum week on Home and here. You can update it anytime.
                  </p>
                  <Button asChild className="mt-4 w-full rounded-2xl">
                    <Link href="/profile/edit">
                      Open profile editor
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </>
              )}
            </Card>

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
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Breastfeeding</p>
                  <p className="mt-0.5 text-foreground">Feed every 2–3 hours early on; drink water with feeds.</p>
                </li>
                <li className="rounded-xl bg-muted/60 p-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formula</p>
                  <p className="mt-0.5 text-foreground">Follow safe prep and hygiene; your pediatrician can adjust volumes.</p>
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
                <Link href="/vitals">Open vitals</Link>
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
                    <Link href="/emergency">Emergency & hospitals</Link>
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
              <div className="flex justify-between gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
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

            <div className="grid grid-cols-2 gap-3">
              <Button asChild variant="outline" className="h-auto flex-col gap-1 rounded-2xl py-4">
                <Link href="/chat">
                  <Sparkles className="h-5 w-5" />
                  <span>Ask AI</span>
                </Link>
              </Button>
              <Button asChild className="h-auto flex-col gap-1 rounded-2xl py-4">
                <Link href="/emergency">
                  <Phone className="h-5 w-5" />
                  <span>Emergency</span>
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-auto flex-col gap-1 rounded-2xl py-4">
                <Link href="/symptoms">
                  <MessageCircle className="h-5 w-5" />
                  <span>Symptoms</span>
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-auto flex-col gap-1 rounded-2xl py-4">
                <Link href="/planner">
                  <CalendarClock className="h-5 w-5" />
                  <span>Planner</span>
                </Link>
              </Button>
            </div>

            <Button asChild variant="ghost" className="w-full rounded-2xl text-muted-foreground">
              <Link href="/profile/edit">
                <UserCircle className="mr-2 h-4 w-4" />
                Update pregnancy & birth date
              </Link>
            </Button>
      </div>
    </AppShell>
  );
}
