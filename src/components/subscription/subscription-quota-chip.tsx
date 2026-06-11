"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { PremiumBadge } from "@/components/subscription/premium-badge";
import type { SubscriptionQuota } from "@/lib/subscription/types";
import { cn } from "@/lib/utils";

type SubscriptionQuotaChipProps = {
  label: string;
  quota: SubscriptionQuota;
  isPremium: boolean;
  variant?: "default" | "plain";
};

export function SubscriptionQuotaChip({
  label,
  quota,
  isPremium,
  variant = "default",
}: SubscriptionQuotaChipProps) {
  const { t } = useTranslation("health");

  const wrapperClass = cn(
    "flex items-center justify-between gap-3 text-xs",
    variant === "default" && "rounded-xl border border-border/70 bg-muted/20 px-3 py-2",
  );

  if (isPremium) {
    return (
      <div className={wrapperClass}>
        <span className="text-muted-foreground">{label}</span>
        <PremiumBadge compact />
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <span className="text-muted-foreground">{label}</span>
      <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 font-medium">
        <span>
          {quota.remaining ?? 0} of {quota.limit ?? 0} left this month
        </span>
        <Link href="/subscription" className="text-primary underline-offset-2 hover:underline">
          {t("subscription_upgrade_short")}
        </Link>
      </span>
    </div>
  );
}
