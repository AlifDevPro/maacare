"use client";

import Link from "next/link";
import { Crown, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PREMIUM_PRICE_BDT } from "@/lib/subscription/constants";
import { useSubscription } from "@/lib/subscription/use-subscription";
import { cn } from "@/lib/utils";

type SubscriptionUpgradePromptProps = {
  variant?: "compact" | "inline";
  className?: string;
};

export function SubscriptionUpgradePrompt({
  variant = "compact",
  className,
}: SubscriptionUpgradePromptProps) {
  const { t } = useTranslation("health");
  const { subscription, loading, openPaywall } = useSubscription();

  if (loading) {
    return <Skeleton className={cn("h-16 w-full rounded-xl", className)} />;
  }

  if (subscription.isPremium) {
    return null;
  }

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2 text-xs",
          className,
        )}
      >
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Crown className="h-3.5 w-3.5 text-amber-600" />
          {t("subscription_upgrade_headline")}
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            ৳{PREMIUM_PRICE_BDT}/{t("subscription_per_month")}
          </span>
          <Button
            type="button"
            size="sm"
            className="h-7 rounded-lg px-2.5 text-[11px]"
            onClick={() => openPaywall()}
          >
            {t("subscription_upgrade_short")}
          </Button>
          <Link href="/subscription" className="text-primary underline-offset-2 hover:underline">
            {t("subscription_view_plans")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("border-primary/20 bg-primary/[0.03] p-3.5 shadow-soft", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Crown className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("subscription_upgrade_headline")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ৳{PREMIUM_PRICE_BDT} {t("subscription_per_month")}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" className="rounded-xl" onClick={() => openPaywall()}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {t("subscription_upgrade_short")}
            </Button>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link href="/subscription">{t("subscription_view_plans")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
