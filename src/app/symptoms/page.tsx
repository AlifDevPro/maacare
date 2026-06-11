"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Activity, Droplets, Brain, Heart, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { SubscriptionUpgradePrompt } from "@/components/subscription/subscription-upgrade-prompt";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    titleKey: "symptomGroup_common",
    icon: Heart,
    items: ["sym_fever", "sym_headache", "sym_nausea", "sym_fatigue", "sym_swelling", "sym_heartburn"],
  },
  {
    titleKey: "symptomGroup_pain",
    icon: Activity,
    items: ["sym_back_pain", "sym_pelvic_pain", "sym_cramps", "sym_leg_cramps"],
  },
  {
    titleKey: "symptomGroup_bleeding",
    icon: Droplets,
    items: ["sym_spotting", "sym_heavy_bleeding", "sym_discharge"],
  },
  {
    titleKey: "symptomGroup_mental",
    icon: Brain,
    items: ["sym_anxiety", "sym_sadness", "sym_sleep", "sym_mood"],
  },
] as const;

export default function SymptomsPage() {
  const { t } = useTranslation("health");
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [severity, setSeverity] = useState(2);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function toggle(code: string) {
    setSelected((arr) => (arr.includes(code) ? arr.filter((x) => x !== code) : [...arr, code]));
  }

  const canSubmit = selected.length > 0 || other.trim().length > 0;

  async function analyze() {
    const level = severity >= 7 ? "high" : severity >= 4 ? "medium" : "low";
    const otherTrim = other.trim();
    const title =
      selected.length > 0
        ? selected
            .slice(0, 2)
            .map((c) => t(c))
            .join(", ")
        : otherTrim
          ? otherTrim.split(/\r?\n/).find((l) => l.trim())?.slice(0, 80).trim() || t("symptoms_title_custom")
          : t("symptoms_title_check");
    setSaving(true);
    let logId: string | null = null;
    try {
      const res = await fetch("/api/symptoms/log", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptomCodes: selected,
          title,
          description: other.trim() || undefined,
          severity,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };
      if (res.ok && j.id) logId = j.id;
    } finally {
      setSaving(false);
    }
    const countParam = selected.length > 0 ? selected.length : otherTrim ? 1 : 0;
    router.push(
      `/symptoms/result?level=${level}&count=${countParam}&severity=${severity}${logId ? `&logId=${encodeURIComponent(logId)}` : ""}`,
    );
  }

  const severityLabel =
    severity <= 3 ? t("symptoms_mild") : severity <= 6 ? t("symptoms_moderate") : t("symptoms_severe");

  return (
    <AppShell>
      <AppHeader title={t("symptoms_header_title")} showBack />

      <div className="space-y-5 px-4 pt-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">{t("symptoms_step")}</p>
          <h1 className="mt-1 font-display text-xl font-semibold text-balance">{t("symptoms_heading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("symptoms_privacy")}</p>
        </div>

        <SubscriptionUpgradePrompt variant="inline" />

        {GROUPS.map(({ titleKey, icon: Icon, items }) => (
          <div key={titleKey}>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <h2 className="font-display text-sm font-semibold">{t(titleKey)}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {items.map((code) => {
                const active = selected.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggle(code)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-soft"
                        : "border-border bg-card text-foreground/80 hover:border-primary/40",
                    )}
                  >
                    {t(code)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <h2 className="mb-2 font-display text-sm font-semibold">{t("symptoms_anything_else")}</h2>
          <Textarea
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder={t("symptoms_other_placeholder")}
            className="min-h-[88px] rounded-2xl bg-card"
          />
        </div>

        <Card className="space-y-3 p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">{t("symptoms_how_severe")}</h2>
            <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
              {severityLabel}
            </span>
          </div>
          <Slider value={[severity]} onValueChange={([v]) => setSeverity(v)} min={1} max={10} step={1} />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{t("symptoms_slider_low")}</span>
            <span>{t("symptoms_slider_high")}</span>
          </div>
        </Card>

        <div className="flex items-start gap-2 rounded-2xl bg-accent-soft/50 p-3 text-xs text-foreground/80">
          <AlertCircle className="h-4 w-4 shrink-0 text-accent" />
          <span>{t("symptoms_emergency_note")}</span>
        </div>

        <Button size="lg" className="w-full rounded-2xl" disabled={!canSubmit || saving} onClick={() => void analyze()}>
          {saving ? t("symptoms_saving") : t("symptoms_analyze")}
        </Button>
      </div>
    </AppShell>
  );
}
