"use client";
import { useState } from "react";
import Link from "next/link";

import { Sun, Apple, Droplets, Moon, Check, Plus, Bell } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function PlannerPage() {
  const [glasses, setGlasses] = useState(4);
  const [reminders, setReminders] = useState({ water: true, meals: true, walk: false });
  const [done, setDone] = useState(false);

  return (
    <AppShell>
      <AppHeader title="Your daily care plan" showBack />

      <div className="space-y-4 px-4 pt-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
            Today · Week 20
          </p>
          <h1 className="mt-1 font-display text-xl font-semibold text-balance">
            Personalized for your second trimester
          </h1>
        </div>

        {/* Morning */}
        <PlanCard icon={Sun} tone="rose" title="Morning routine">
          <Item label="10 min gentle walk or yoga">
            <Link href="/guidance/movement" className="text-xs text-primary">
              Why
            </Link>
          </Item>
          <Item label="Glass of warm water + lemon" />
          <Item label="Prenatal vitamin" />
        </PlanCard>

        {/* Nutrition */}
        <PlanCard icon={Apple} tone="sage" title="Nutrition plan">
          <div className="space-y-2.5">
            <Meal label="Breakfast" body="Oats with banana, almonds, milk" tag="Iron · Calcium" />
            <Meal label="Lunch" body="Brown rice, lentils, spinach, fish curry" tag="Protein · Iron" />
            <Meal label="Dinner" body="Chapati, mixed vegetables, yogurt" tag="Calcium · Fiber" />
          </div>
        </PlanCard>

        {/* Hydration */}
        <PlanCard icon={Droplets} tone="rose" title="Hydration tracker">
          <div className="mb-2 flex items-end justify-between">
            <p className="text-2xl font-semibold">
              {glasses}<span className="text-base font-medium text-muted-foreground"> / 8</span>
            </p>
            <Button size="sm" variant="outline" onClick={() => setGlasses((g) => Math.min(8, g + 1))} className="rounded-full">
              <Plus className="mr-1 h-3.5 w-3.5" /> Glass
            </Button>
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <button
                key={i}
                onClick={() => setGlasses(i + 1)}
                className={cn(
                  "h-8 rounded-lg border transition-all",
                  i < glasses ? "border-accent bg-accent/80" : "border-border bg-muted",
                )}
                aria-label={`Glass ${i + 1}`}
              />
            ))}
          </div>
        </PlanCard>

        {/* Rest */}
        <PlanCard icon={Moon} tone="sage" title="Rest & sleep">
          <Item label="Aim for 8h sleep tonight" />
          <Item label="20 min nap if tired" />
          <div className="mt-2 space-y-2 border-t border-border pt-2">
            <Toggle label="Water reminder" icon={Droplets} value={reminders.water} onChange={(v) => setReminders((r) => ({ ...r, water: v }))} />
            <Toggle label="Meal reminder" icon={Bell} value={reminders.meals} onChange={(v) => setReminders((r) => ({ ...r, meals: v }))} />
            <Toggle label="Walk reminder" icon={Bell} value={reminders.walk} onChange={(v) => setReminders((r) => ({ ...r, walk: v }))} />
          </div>
        </PlanCard>

        <Button
          size="lg"
          className={cn("w-full rounded-2xl shadow-soft", done && "bg-accent text-accent-foreground hover:bg-accent/90")}
          onClick={() => setDone(true)}
        >
          {done ? <><Check className="mr-2 h-5 w-5" /> Completed</> : "Mark as completed"}
        </Button>
      </div>
    </AppShell>
  );
}

function PlanCard({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof Sun;
  tone: "rose" | "sage";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            tone === "rose" ? "bg-primary-soft text-primary" : "bg-accent-soft text-accent",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="font-display text-base font-semibold">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

function Item({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex h-5 w-5 items-center justify-center rounded-md border border-border" />
        {label}
      </div>
      {children}
    </div>
  );
}

function Meal({ label, body, tag }: { label: string; body: string; tag: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">{tag}</span>
      </div>
      <p className="mt-0.5 text-sm">{body}</p>
    </div>
  );
}

function Toggle({ label, icon: Icon, value, onChange }: { label: string; icon: typeof Sun; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" /> {label}
      </span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
