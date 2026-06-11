"use client";

import Link from "next/link";
import { Check, Crown, Loader2, Lock, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PremiumBadge } from "@/components/subscription/premium-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PREMIUM_PRICE_BDT } from "@/lib/subscription/constants";
import { useSubscription } from "@/lib/subscription/use-subscription";
import { cn } from "@/lib/utils";

type SubscriptionStatusCardProps = {
  variant?: "compact" | "full";
  className?: string;
};

function QuotaMeter({
  label,
  used,
  limit,
  unlimited,
}: {
  label: string;
  used: number;
  limit: number | null;
  unlimited: boolean;
}) {
  const max = limit ?? 1;
  const pct = unlimited ? 100 : Math.min(100, Math.round((used / max) * 100));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {unlimited ? "Unlimited" : `${Math.max(0, (limit ?? 0) - used)}/${limit} left`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
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

export function SubscriptionStatusCard({ variant = "full", className }: SubscriptionStatusCardProps) {
  const { t } = useTranslation("health");
  const { subscription, loading, error, upgrading, upgrade, refresh } = useSubscription();

  if (loading) {
    return (
      <Card className={cn("space-y-3 p-4", className)}>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-9 w-full rounded-xl" />
      </Card>
    );
  }

  const isPremium = subscription.isPremium;
  const reportQuota = subscription.quotas.reportSimplification;
  const symptomQuota = subscription.quotas.symptomAnalysis;

  return (
    <Card
      className={cn(
        "overflow-hidden border-border/80 p-4",
        isPremium && "border-amber-500/30 bg-amber-500/[0.04]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("subscription_your_plan")}
          </p>
          <p className="mt-1 font-display text-lg font-semibold">
            {isPremium ? t("subscription_premium") : t("subscription_free")}
          </p>
        </div>
        {isPremium ? <PremiumBadge /> : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          <p>{t("subscription_load_error")}</p>
          <Button variant="link" className="mt-1 h-auto p-0 text-xs" onClick={() => void refresh()}>
            {t("subscription_retry")}
          </Button>
        </div>
      ) : null}

      <div className={cn("mt-4 space-y-3", variant === "compact" && "mt-3")}>
        <QuotaMeter
          label={t("subscription_reports_label")}
          used={reportQuota.used}
          limit={reportQuota.limit}
          unlimited={isPremium}
        />
        <QuotaMeter
          label={t("subscription_symptoms_label")}
          used={symptomQuota.used}
          limit={symptomQuota.limit}
          unlimited={isPremium}
        />
      </div>

      {variant === "full" ? (
        <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            {subscription.features.doctor_messaging ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {t("subscription_feature_doctor_messaging")}
          </li>
          <li className="flex items-center gap-2">
            {subscription.features.nearby_facilities ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {t("subscription_feature_nearby_facilities")}
          </li>
        </ul>
      ) : null}

      {!isPremium ? (
        <div className={cn("mt-4 flex flex-col gap-2", variant === "compact" && "sm:flex-row")}>
          <Button
            className="rounded-xl"
            size={variant === "compact" ? "sm" : "default"}
            disabled={upgrading}
            onClick={() => void upgrade()}
          >
            {upgrading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {t("subscription_upgrade_cta", { price: PREMIUM_PRICE_BDT })}
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            size={variant === "compact" ? "sm" : "default"}
            asChild
          >
            <Link href="/subscription">
              <Crown className="mr-2 h-4 w-4" />
              {t("subscription_compare_plans")}
            </Link>
          </Button>
        </div>
      ) : subscription.subscriptionEndDate ? (
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
    </Card>
  );
}
