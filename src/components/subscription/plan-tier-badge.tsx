"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription } from "@/lib/subscription/use-subscription";
import { cn } from "@/lib/utils";

type PlanTierBadgeProps = {
  className?: string;
  loadingClassName?: string;
  /** When true, Free badge links to /subscription. */
  linkToSubscription?: boolean;
};

export function PlanTierBadge({ className, loadingClassName, linkToSubscription }: PlanTierBadgeProps) {
  const { t } = useTranslation("health");
  const { subscription, loading } = useSubscription();

  if (loading) {
    return <Skeleton className={cn("h-5 w-16 rounded-full", loadingClassName)} />;
  }

  if (subscription.isPremium) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 shadow-sm ring-1 ring-amber-500/25 dark:text-amber-300",
          className,
        )}
      >
        <Crown className="h-3 w-3" aria-hidden />
        {t("subscription_premium")}
      </span>
    );
  }

  const badge = (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm ring-1 ring-primary/20",
        linkToSubscription && "transition-colors hover:bg-primary/15",
        className,
      )}
    >
      {t("subscription_free")}
    </span>
  );

  if (linkToSubscription) {
    return (
      <Link href="/subscription" className="inline-flex" aria-label={t("subscription_upgrade_from_home")}>
        {badge}
      </Link>
    );
  }

  return badge;
}
