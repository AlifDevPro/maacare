"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Suspense, useEffect, useMemo, useState } from "react";

import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, MapPin, MessageCircle, Shield, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { z } from "zod";
import { useTranslation } from "react-i18next";

import {
  SymptomsAiInsightSkeleton,
  SymptomsAiSuggestionsSkeleton,
} from "@/app/symptoms/result/symptoms-ai-skeleton";
import { SubscriptionQuotaChip } from "@/components/subscription/subscription-quota-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { isSubscriptionPaywallError } from "@/lib/subscription/access";
import { useSubscription } from "@/lib/subscription/use-subscription";

type InsightLoadState = "idle" | "loading" | "done";

const search = z.object({
  level: z.enum(["low", "medium", "high"]).default("low"),
  count: z.coerce.number().default(0),
  severity: z.coerce.number().default(1),
});

const COPY = {
  low: {
    title: "Low Risk",
    color: "bg-risk-low text-risk-low-foreground",
    ring: "ring-risk-low-foreground/20",
    explain:
      "Your symptoms appear mild and are common during pregnancy. Keep monitoring how you feel and follow simple self-care tips.",
    tips: ["Drink 8+ glasses of water", "Rest when tired", "Eat balanced meals", "Light walking helps"],
  },
  medium: {
    title: "Medium Risk",
    color: "bg-risk-medium text-risk-medium-foreground",
    ring: "ring-risk-medium-foreground/20",
    explain:
      "Your symptoms warrant attention. Track them closely and contact your doctor if they worsen or persist.",
    tips: ["Call your provider within 24h", "Track symptom timing", "Avoid strenuous activity", "Stay hydrated"],
  },
  high: {
    title: "High Risk",
    color: "bg-risk-high text-risk-high-foreground",
    ring: "ring-risk-high-foreground/30",
    explain:
      "Your symptoms could indicate a serious condition. Please seek medical care immediately.",
    tips: ["Call your doctor now", "Or go to the nearest hospital", "Do not drive yourself", "Bring a support person"],
  },
} as const;

function SymptomsResultFallback() {
  const { t } = useTranslation("health");
  return (
    <AppShell>
      <AppHeader title={t("symptoms_result_title")} showBack />
      <div className="flex justify-center px-4 pt-12 text-sm text-muted-foreground">{t("symptoms_result_loading")}</div>
    </AppShell>
  );
}

function SymptomsResultInner() {
  const { t, i18n } = useTranslation("health");
  const searchParams = useSearchParams();
  const [logInsight, setLogInsight] = useState<string | null>(null);
  const [logSuggestions, setLogSuggestions] = useState<string[]>([]);
  const [levelFromLog, setLevelFromLog] = useState<"low" | "medium" | "high" | null>(null);
  const [logMeta, setLogMeta] = useState<{ title: string | null; loggedAt: string } | null>(null);
  const [logUserNotes, setLogUserNotes] = useState<string | null>(null);
  const [insightLoadState, setInsightLoadState] = useState<InsightLoadState>("idle");
  const [paywallBlocked, setPaywallBlocked] = useState(false);
  const { subscription, loading: subLoading, openPaywall } = useSubscription();

  const { level: levelFromUrl } = useMemo(() => {
    const parsed = search.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : search.parse({});
  }, [searchParams]);
  const logId = searchParams.get("logId") ?? "";

  useEffect(() => {
    let alive = true;
    if (!logId) {
      setLogInsight(null);
      setLogSuggestions([]);
      setLevelFromLog(null);
      setLogMeta(null);
      setLogUserNotes(null);
      setInsightLoadState("idle");
      return;
    }
    async function loadLog() {
      setInsightLoadState("loading");
      try {
        const params = new URLSearchParams({ appLanguage: i18n.language });
        const res = await fetch(
          `/api/symptoms/log/${encodeURIComponent(logId)}?${params.toString()}`,
          { credentials: "include" },
        );
        const j = (await res.json().catch(() => ({}))) as {
          insight?: string;
          level?: string;
          suggestions?: string[];
          log?: { title: string | null; loggedAt: string; description?: string | null };
        };
        if (!res.ok) {
          if (res.status === 403 && isSubscriptionPaywallError(j)) {
            setPaywallBlocked(true);
            openPaywall("symptom_analysis");
          }
          return;
        }
        setPaywallBlocked(false);
        if (!alive) return;
        if (j.level === "low" || j.level === "medium" || j.level === "high") {
          setLevelFromLog(j.level);
        }
        setLogInsight(typeof j.insight === "string" ? j.insight : null);
        setLogSuggestions(Array.isArray(j.suggestions) ? j.suggestions.filter((s) => typeof s === "string" && s.trim()) : []);
        if (j.log) {
          setLogMeta({ title: j.log.title ?? null, loggedAt: j.log.loggedAt });
          const raw = j.log.description;
          setLogUserNotes(typeof raw === "string" && raw.trim() ? raw.trim() : null);
        } else {
          setLogUserNotes(null);
        }
      } catch {
        /* keep URL-level fallback */
      } finally {
        if (alive) setInsightLoadState("done");
      }
    }
    void loadLog();
    return () => {
      alive = false;
    };
  }, [logId, i18n.language]);

  const displayLevel = (levelFromLog ?? levelFromUrl) as keyof typeof COPY;
  const c = COPY[displayLevel] ?? COPY.low;

  const awaitingAi = insightLoadState === "loading" && Boolean(logId);
  const showAiInsight = Boolean(logInsight?.trim());
  const showAiSuggestions = logSuggestions.length > 0;
  const showStaticTips =
    (insightLoadState === "idle" && !logId) ||
    (insightLoadState === "done" && !showAiInsight && !showAiSuggestions);
  const aiLoadingLabel = t("symptoms_result_ai_loading");

  return (
    <AppShell>
      <AppHeader title={t("symptoms_result_title")} showBack />

      <div className="space-y-5 px-4 pt-4">
        {subLoading ? (
          <Skeleton className="h-10 w-full rounded-xl" />
        ) : (
          <SubscriptionQuotaChip
            label="Symptom analysis"
            quota={subscription.quotas.symptomAnalysis}
            isPremium={subscription.isPremium}
          />
        )}

        {paywallBlocked ? (
          <Card className="border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <p className="font-semibold">{t("subscription_premium_required")}</p>
            <Button className="mt-3 rounded-xl" size="sm" onClick={() => openPaywall("symptom_analysis")}>
              {t("subscription_upgrade_short")}
            </Button>
          </Card>
        ) : null}

        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
        >
          <Card className={`overflow-hidden border-0 ${c.color} ring-4 ${c.ring} shadow-card`}>
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card/40 backdrop-blur">
                <Shield className="h-7 w-7" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Risk result</p>
              <h1 className="font-display text-3xl font-semibold tracking-tight">{c.title}</h1>
              <p className="max-w-[28ch] text-sm leading-relaxed opacity-90">{c.explain}</p>
            </div>
          </Card>
        </motion.div>

        {logUserNotes ? (
          <Card className="rounded-2xl border border-border/70 bg-muted/15 p-4 shadow-soft">
            <h2 className="mb-1.5 font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Additional details you shared
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{logUserNotes}</p>
          </Card>
        ) : null}

        {awaitingAi ? (
          <>
            <SymptomsAiInsightSkeleton loadingLabel={aiLoadingLabel} />
            <SymptomsAiSuggestionsSkeleton loadingLabel={aiLoadingLabel} />
          </>
        ) : null}

        {showAiInsight ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
          <Card className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.09] via-card to-sky-500/[0.06] p-4 shadow-soft backdrop-blur-[2px]">
            <div className="maacare-ai-shimmer-sweep" aria-hidden />
            <div className="relative">
              <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-violet-500/25 bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 shadow-sm dark:text-violet-200">
                <Sparkles className="h-3 w-3" aria-hidden />
                AI
              </div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600/90 dark:text-violet-300/90">
                AI-generated from your log
              </p>
              <h2 className="mb-2 pr-14 font-display text-sm font-semibold text-foreground">Personalized insight</h2>
              {logMeta ? (
                <p className="mb-2 text-xs text-muted-foreground">
                  {logMeta.title || "Symptom log"} · {new Date(logMeta.loggedAt).toLocaleString()}
                  <span className="text-muted-foreground/80">
                    {" "}
                    · {formatDistanceToNow(new Date(logMeta.loggedAt), { addSuffix: true })}
                  </span>
                </p>
              ) : null}
              <p className="whitespace-pre-line text-sm leading-relaxed tracking-[0.01em] text-foreground/92">
                {logInsight}
              </p>
            </div>
          </Card>
          </motion.div>
        ) : null}

        {showAiSuggestions ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut", delay: 0.05 }}
          >
          <Card className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/[0.08] via-card to-muted/50 p-4 shadow-soft backdrop-blur-[2px]">
            <div className="maacare-ai-shimmer-sweep" aria-hidden />
            <div className="relative">
              <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-sky-500/25 bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 shadow-sm dark:text-sky-100">
                <Sparkles className="h-3 w-3" aria-hidden />
                AI
              </div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-sky-700/90 dark:text-sky-200/90">
                AI-generated suggestions
              </p>
              <h2 className="mb-3 pr-14 font-display text-sm font-semibold">Suggested next steps</h2>
              <ul className="space-y-2.5">
                {logSuggestions.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm leading-snug">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          </motion.div>
        ) : null}

        {showStaticTips ? (
          <Card className="p-4 shadow-soft">
            <h2 className="mb-3 font-display text-sm font-semibold">Recommended next steps</h2>
            <ul className="space-y-2.5">
              {c.tips.map((t: string) => (
                <li key={t} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href="/chat">
              <MessageCircle className="mr-1.5 h-4 w-4" />
              Chat with AI
            </Link>
          </Button>
          <Button asChild className="rounded-2xl">
            <Link href="/emergency">
              <MapPin className="mr-1.5 h-4 w-4" />
              Find hospital
            </Link>
          </Button>
        </div>

        <p className="px-2 text-center text-[11px] text-muted-foreground">
          AI guidance only — not a medical diagnosis. Always consult your doctor.
        </p>
      </div>
    </AppShell>
  );
}

export default function SymptomsResultPage() {
  return (
    <Suspense fallback={<SymptomsResultFallback />}>
      <SymptomsResultInner />
    </Suspense>
  );
}
