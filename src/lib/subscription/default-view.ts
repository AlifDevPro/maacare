import { FREE_MONTHLY_LIMIT, PREMIUM_PRICE_BDT } from "@/lib/subscription/constants";
import type { SubscriptionView } from "@/lib/subscription/types";
import { nextUsageResetAt } from "@/lib/subscription/usage";

export function defaultFreeSubscriptionView(): SubscriptionView {
  return {
    plan: "free",
    subscriptionStatus: "inactive",
    isPremium: false,
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    usageResetAt: nextUsageResetAt(),
    quotas: {
      reportSimplification: {
        used: 0,
        limit: FREE_MONTHLY_LIMIT,
        remaining: FREE_MONTHLY_LIMIT,
      },
      symptomAnalysis: {
        used: 0,
        limit: null,
        remaining: null,
      },
    },
    features: {
      report_simplification: true,
      symptom_analysis: true,
      doctor_messaging: false,
      nearby_facilities: false,
    },
    premiumPriceBdt: PREMIUM_PRICE_BDT,
  };
}
