import type { SubscriptionFeature } from "@/lib/subscription/types";

export const PREMIUM_PRICE_BDT = 999;

export const FREE_MONTHLY_LIMIT = 2;

export const PAYWALL_MESSAGE = "Unlock this by buying a subscription.";

export const QUOTA_FEATURES: SubscriptionFeature[] = ["report_simplification"];

export const PREMIUM_ONLY_FEATURES: SubscriptionFeature[] = ["doctor_messaging", "nearby_facilities"];

export const PREMIUM_DURATION_DAYS = 30;
