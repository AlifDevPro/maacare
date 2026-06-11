"use client";

import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSubscription } from "@/lib/subscription/use-subscription";

type PremiumLockedBannerProps = {
  feature: "doctor_messaging" | "nearby_facilities";
  className?: string;
};

const FEATURE_KEYS = {
  doctor_messaging: "subscription_feature_doctor_messaging",
  nearby_facilities: "subscription_feature_nearby_facilities",
} as const;

export function PremiumLockedBanner({ feature, className }: PremiumLockedBannerProps) {
  const { t } = useTranslation("health");
  const { subscription, openPaywall } = useSubscription();

  if (subscription.isPremium || subscription.features[feature]) {
    return null;
  }

  return (
    <Card className={`border-amber-500/40 bg-amber-500/10 p-4 text-sm ${className ?? ""}`}>
      <div className="flex items-start gap-2">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t("subscription_premium_required")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t(FEATURE_KEYS[feature])}</p>
          <Button
            className="mt-3 rounded-xl"
            size="sm"
            onClick={() => openPaywall(feature)}
          >
            {t("subscription_upgrade_short")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
