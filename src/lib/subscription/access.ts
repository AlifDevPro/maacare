import {
  FREE_MONTHLY_LIMIT,
  PAYWALL_MESSAGE,
  PREMIUM_ONLY_FEATURES,
  PREMIUM_PRICE_BDT,
  QUOTA_FEATURES,
} from "@/lib/subscription/constants";
import { applyMonthlyUsageReset, getUsageCount } from "@/lib/subscription/usage";
import type {
  FeatureAccessResult,
  SubscriptionFeature,
  SubscriptionQuota,
  SubscriptionView,
  UserSubscriptionRow,
} from "@/lib/subscription/types";

export function isPremiumActive(row: UserSubscriptionRow, now = new Date()): boolean {
  if (row.plan !== "premium" || row.subscription_status !== "active") return false;
  if (!row.subscription_end_date) return false;
  return new Date(row.subscription_end_date).getTime() > now.getTime();
}

export function buildQuota(used: number, isPremium: boolean): SubscriptionQuota {
  if (isPremium) {
    return { used, limit: null, remaining: null };
  }
  const remaining = Math.max(0, FREE_MONTHLY_LIMIT - used);
  return { used, limit: FREE_MONTHLY_LIMIT, remaining };
}

export function toSubscriptionView(row: UserSubscriptionRow): SubscriptionView {
  const premium = isPremiumActive(row);
  const reportUsed = row.report_simplification_used_this_month;
  const symptomUsed = row.symptom_analysis_used_this_month;

  const features: Record<SubscriptionFeature, boolean> = {
    report_simplification: premium || reportUsed < FREE_MONTHLY_LIMIT,
    symptom_analysis: premium || symptomUsed < FREE_MONTHLY_LIMIT,
    doctor_messaging: premium,
    nearby_facilities: premium,
  };

  return {
    plan: premium ? "premium" : "free",
    subscriptionStatus: premium ? row.subscription_status : row.subscription_status,
    isPremium: premium,
    subscriptionStartDate: row.subscription_start_date,
    subscriptionEndDate: row.subscription_end_date,
    usageResetAt: row.usage_reset_at,
    quotas: {
      reportSimplification: buildQuota(reportUsed, premium),
      symptomAnalysis: buildQuota(symptomUsed, premium),
    },
    features,
    premiumPriceBdt: PREMIUM_PRICE_BDT,
  };
}

export function evaluateFeatureAccess(
  row: UserSubscriptionRow,
  feature: SubscriptionFeature,
): FeatureAccessResult {
  const normalized = applyMonthlyUsageReset(row);
  const premium = isPremiumActive(normalized);

  if (premium) {
    return { allowed: true, subscription: normalized };
  }

  if (PREMIUM_ONLY_FEATURES.includes(feature)) {
    return {
      allowed: false,
      code: "FEATURE_LOCKED",
      feature,
      message: PAYWALL_MESSAGE,
      subscription: normalized,
    };
  }

  if (QUOTA_FEATURES.includes(feature)) {
    const used = getUsageCount(
      normalized,
      feature as "report_simplification" | "symptom_analysis",
    );
    if (used >= FREE_MONTHLY_LIMIT) {
      return {
        allowed: false,
        code: "USAGE_LIMIT_REACHED",
        feature,
        message: PAYWALL_MESSAGE,
        subscription: normalized,
      };
    }
    return { allowed: true, subscription: normalized };
  }

  return { allowed: true, subscription: normalized };
}

export function isSubscriptionPaywallError(payload: unknown): payload is {
  error: "subscription_required";
  code: string;
  feature: SubscriptionFeature;
} {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { error?: string }).error === "subscription_required"
  );
}
