export type SubscriptionPlan = "free" | "premium";

export type SubscriptionStatus = "active" | "inactive" | "expired" | "canceled";

export type SubscriptionFeature =
  | "report_simplification"
  | "symptom_analysis"
  | "doctor_messaging"
  | "nearby_facilities";

export type PaywallCode = "USAGE_LIMIT_REACHED" | "FEATURE_LOCKED";

export type UserSubscriptionRow = {
  user_id: string;
  plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  report_simplification_used_this_month: number;
  symptom_analysis_used_this_month: number;
  usage_reset_at: string;
  created_at: string;
  updated_at: string;
};

export type SubscriptionQuota = {
  used: number;
  limit: number | null;
  remaining: number | null;
};

export type SubscriptionView = {
  plan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  isPremium: boolean;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  usageResetAt: string;
  quotas: {
    reportSimplification: SubscriptionQuota;
    symptomAnalysis: SubscriptionQuota;
  };
  features: Record<SubscriptionFeature, boolean>;
  premiumPriceBdt: number;
};

export type FeatureAccessResult =
  | { allowed: true; subscription: UserSubscriptionRow }
  | {
      allowed: false;
      code: PaywallCode;
      feature: SubscriptionFeature;
      message: string;
      subscription: UserSubscriptionRow;
    };
