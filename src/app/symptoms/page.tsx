"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Activity, Droplets, Brain, Heart, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    title: "Common",
    icon: Heart,
    items: ["Fever", "Headache", "Nausea", "Fatigue", "Swelling", "Heartburn"],
  },
  {
    title: "Pain",
    icon: Activity,
    items: ["Back pain", "Pelvic pain", "Cramps", "Leg cramps"],
  },
  {
    title: "Bleeding",
    icon: Droplets,
    items: ["Spotting", "Heavy bleeding", "Discharge change"],
  },
  {
    title: "Mental",
    icon: Brain,
    items: ["Anxiety", "Sadness", "Sleep trouble", "Mood swings"],
  },
] as const;

export default function SymptomsPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [severity, setSeverity] = useState(2);
  const router = useRouter();

  function toggle(s: string) {
    setSelected((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]));
  }

  function analyze() {
    const level = severity >= 7 ? "high" : severity >= 4 ? "medium" : "low";
    router.push(
      `/symptoms/result?level=${level}&count=${selected.length}&severity=${severity}`,
    );
  }

  const severityLabel = severity <= 3 ? "Mild" : severity <= 6 ? "Moderate" : "Severe";

  return (
    <AppShell>
      <AppHeader title="Check your symptoms" showBack />

      <div className="space-y-5 px-4 pt-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
            Step 1 of 2
          </p>
          <h1 className="mt-1 font-display text-xl font-semibold text-balance">
            Tell us what you're feeling
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap all that apply. Your answers stay private.
          </p>
        </div>

        {GROUPS.map(({ title, icon: Icon, items }) => (
          <div key={title}>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <h2 className="font-display text-sm font-semibold">{title}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {items.map((item) => {
                const active = selected.includes(item);
                return (
                  <button
                    key={item}
                    onClick={() => toggle(item)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-soft"
                        : "border-border bg-card text-foreground/80 hover:border-primary/40",
                    )}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <h2 className="mb-2 font-display text-sm font-semibold">Anything else?</h2>
          <Textarea
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="Other symptoms (optional)"
            className="min-h-[88px] rounded-2xl bg-card"
          />
        </div>

        <Card className="space-y-3 p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">How severe is it?</h2>
            <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
              {severityLabel}
            </span>
          </div>
          <Slider
            value={[severity]}
            onValueChange={([v]) => setSeverity(v)}
            min={1}
            max={10}
            step={1}
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Mild</span>
            <span>Severe</span>
          </div>
        </Card>

        <div className="flex items-start gap-2 rounded-2xl bg-accent-soft/50 p-3 text-xs text-foreground/80">
          <AlertCircle className="h-4 w-4 shrink-0 text-accent" />
          <span>
            For sudden severe symptoms (heavy bleeding, severe headache), call emergency services
            immediately.
          </span>
        </div>

        <Button
          size="lg"
          className="w-full rounded-2xl"
          disabled={selected.length === 0}
          onClick={analyze}
        >
          Analyze risk
        </Button>
      </div>
    </AppShell>
  );
}
