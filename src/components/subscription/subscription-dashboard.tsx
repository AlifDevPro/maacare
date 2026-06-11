"use client";

import Link from "next/link";
import {
  Check,
  Crown,
  FileText,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { PlanTierBadge } from "@/components/subscription/plan-tier-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PREMIUM_PRICE_BDT } from "@/lib/subscription/constants";
import { useSubscription } from "@/lib/subscription/use-subscription";
import { cn } from "@/lib/utils";

function UsageTile({
  icon: Icon,
  label,
  remaining,
  limit,
  unlimited,
}: {
  icon: typeof FileText;
  label: string;
  remaining: number | null;
  limit: number | null;
  unlimited: boolean;
}) {
  const pct = unlimited ? 100 : limit ? Math.min(100, Math.round(((limit - (remaining ?? 0)) / limit) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-3.5 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            unlimited
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : (remaining ?? 0) === 0
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
          )}
        >
          {unlimited ? "∞" : `${remaining ?? 0}/${limit}`}
        </span>
      </div>
      <p className="mt-2 text-xs font-medium text-foreground">{label}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            unlimited ? "bg-amber-500" : pct >= 100 ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: unlimited ? "100%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

function EntitlementChip({
  label,
  unlocked,
  icon: Icon,
}: {
  label: string;
  unlocked: boolean;
  icon: typeof MessageCircle;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium",
        unlocked
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200"
          : "border-border/70 bg-muted/20 text-muted-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {unlocked ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
      ) : (
        <Lock className="h-3.5 w-3.5 shrink-0 opacity-60" />
      )}
    </div>
  );
}

type SubscriptionDashboardProps = {
  success?: boolean;
  onUpgrade: () => void | Promise<void>;
};

export function SubscriptionDashboard({ success, onUpgrade }: SubscriptionDashboardProps) {
  const { t } = useTranslation("health");
  const { subscription, loading, error, upgrading, refresh } = useSubscription();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  const isPremium = subscription.isPremium;
  const reportQ = subscription.quotas.reportSimplification;
  const symptomQ = subscription.quotas.symptomAnalysis;

  return (
    <div className="space-y-4">
      {success ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">
          {t("subscription_premium_success")}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-100">
          <p>{t("subscription_load_error")}</p>
          <Button variant="link" className="mt-1 h-auto p-0 text-xs" onClick={() => void refresh()}>
            {t("subscription_retry")}
          </Button>
        </div>
      ) : null}

      <Card className="overflow-hidden border-0 bg-gradient-hero p-0 shadow-card">
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">
                {t("subscription_your_plan")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PlanTierBadge />
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    isPremium
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {isPremium ? t("subscription_status_active") : t("subscription_status_free")}
                </span>
              </div>
            </div>
            {!isPremium ? (
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("subscription_premium")}
                </p>
                <p className="font-display text-xl font-bold">৳{PREMIUM_PRICE_BDT}</p>
                <p className="text-[10px] text-muted-foreground">{t("subscription_per_month")}</p>
              </div>
            ) : null}
          </div>

          {isPremium && subscription.subscriptionEndDate ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("subscription_active_until", {
                date: new Date(subscription.subscriptionEndDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
              })}
            </p>
          ) : null}
        </div>
      </Card>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("subscription_usage_title")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <UsageTile
            icon={FileText}
            label={t("subscription_reports_label")}
            remaining={reportQ.remaining}
            limit={reportQ.limit}
            unlimited={isPremium}
          />
          <UsageTile
            icon={Stethoscope}
            label={t("subscription_symptoms_label")}
            remaining={symptomQ.remaining}
            limit={symptomQ.limit}
            unlimited={isPremium}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("subscription_entitlements_title")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <EntitlementChip
            icon={MessageCircle}
            label={t("subscription_feature_doctor_messaging")}
            unlocked={subscription.features.doctor_messaging}
          />
          <EntitlementChip
            icon={MapPin}
            label={t("subscription_feature_nearby_facilities")}
            unlocked={subscription.features.nearby_facilities}
          />
          <EntitlementChip
            icon={FileText}
            label={t("subscription_reports_label")}
            unlocked={subscription.features.report_simplification}
          />
          <EntitlementChip
            icon={Stethoscope}
            label={t("subscription_symptoms_label")}
            unlocked={subscription.features.symptom_analysis}
          />
        </div>
      </div>

      {!isPremium ? (
        <Card className="border-primary/20 bg-primary/[0.03] p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Crown className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t("subscription_upgrade_headline")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  t("subscription_premium_chip_unlimited"),
                  t("subscription_premium_chip_doctor"),
                  t("subscription_premium_chip_nearby"),
                ].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/60"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <Button
                className="mt-3 w-full rounded-xl sm:w-auto"
                disabled={upgrading}
                onClick={() => void onUpgrade()}
              >
                {upgrading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {t("subscription_upgrade_cta", { price: PREMIUM_PRICE_BDT })}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-amber-500/25 bg-amber-500/[0.04] p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            {t("subscription_premium_active_title")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t("subscription_premium_active_body")}</p>
        </Card>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" className="w-full rounded-xl" asChild>
          <Link href="/profile">{t("subscription_back_profile")}</Link>
        </Button>
        <Button variant="outline" className="w-full rounded-xl" asChild>
          <Link href="/settings">{t("subscription_back_settings")}</Link>
        </Button>
      </div>
    </div>
  );
}
