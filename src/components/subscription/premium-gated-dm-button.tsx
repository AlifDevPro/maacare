"use client";

import Link from "next/link";
import { Crown, Lock, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription } from "@/lib/subscription/use-subscription";
import { cn } from "@/lib/utils";

type PremiumGatedDmButtonProps = {
  peerUserId: string;
  /** When true, messaging this peer requires Premium (verified doctors only). */
  peerVerifiedProfessional?: boolean;
  className?: string;
  label?: string;
};

export function PremiumGatedDmButton({
  peerUserId,
  peerVerifiedProfessional = false,
  className,
  label,
}: PremiumGatedDmButtonProps) {
  const { t } = useTranslation("health");
  const { subscription, loading, openPaywall } = useSubscription();

  const buttonLabel = label ?? t("subscription_dm_locked_label");

  if (loading) {
    return <Skeleton className={cn("h-10 w-full rounded-xl", className)} />;
  }

  const requiresPremium = peerVerifiedProfessional;
  const unlocked = !requiresPremium || subscription.features.doctor_messaging;

  if (unlocked) {
    return (
      <Button
        asChild
        className={cn("h-10 w-full rounded-xl text-sm font-semibold", className)}
        size="default"
      >
        <Link href={`/messages/start?peer=${peerUserId}`}>
          <MessageCircle className="mr-2 h-4 w-4" />
          {buttonLabel}
        </Link>
      </Button>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full rounded-xl border-dashed border-amber-500/40 bg-amber-500/5 text-sm font-semibold text-foreground hover:bg-amber-500/10"
        onClick={() => openPaywall("doctor_messaging")}
      >
        <Lock className="mr-2 h-4 w-4 text-amber-700 dark:text-amber-300" />
        {buttonLabel}
        <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          <Crown className="h-2.5 w-2.5" />
          {t("subscription_premium")}
        </span>
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">{t("subscription_dm_locked_hint")}</p>
    </div>
  );
}
