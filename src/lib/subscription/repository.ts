import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluateFeatureAccess, isPremiumActive, toSubscriptionView } from "@/lib/subscription/access";
import { PREMIUM_DURATION_DAYS } from "@/lib/subscription/constants";
import {
  applyMonthlyUsageReset,
  incrementUsageCount,
  nextUsageResetAt,
  shouldResetMonthlyUsage,
} from "@/lib/subscription/usage";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";
import type {
  FeatureAccessResult,
  SubscriptionFeature,
  SubscriptionView,
  UserSubscriptionRow,
} from "@/lib/subscription/types";

function defaultSubscriptionRow(userId: string): UserSubscriptionRow {
  const now = new Date();
  return {
    user_id: userId,
    plan: "free",
    subscription_status: "inactive",
    subscription_start_date: null,
    subscription_end_date: null,
    report_simplification_used_this_month: 0,
    symptom_analysis_used_this_month: 0,
    usage_reset_at: nextUsageResetAt(now),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

function resolveSubscriptionDb(
  fallback?: SupabaseClient,
): SupabaseClient {
  const svc = tryCreateSupabaseServiceClient();
  if (svc) return svc;
  if (fallback) return fallback;
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for subscription operations.");
}

async function persistSubscriptionRow(
  supabase: SupabaseClient,
  row: UserSubscriptionRow,
): Promise<UserSubscriptionRow> {
  const { data, error } = await supabase
    .from("user_subscriptions")
    .upsert(
      {
        user_id: row.user_id,
        plan: row.plan,
        subscription_status: row.subscription_status,
        subscription_start_date: row.subscription_start_date,
        subscription_end_date: row.subscription_end_date,
        report_simplification_used_this_month: row.report_simplification_used_this_month,
        symptom_analysis_used_this_month: row.symptom_analysis_used_this_month,
        usage_reset_at: row.usage_reset_at,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save subscription");
  return data as UserSubscriptionRow;
}

async function expirePremiumIfNeeded(
  supabase: SupabaseClient,
  row: UserSubscriptionRow,
): Promise<UserSubscriptionRow> {
  if (row.plan === "premium" && row.subscription_status === "active" && !isPremiumActive(row)) {
    const expired: UserSubscriptionRow = {
      ...row,
      plan: "free",
      subscription_status: row.subscription_end_date ? "expired" : "inactive",
      subscription_start_date: null,
      subscription_end_date: null,
    };
    return persistSubscriptionRow(supabase, expired);
  }
  return row;
}

export async function getOrCreateUserSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserSubscriptionRow> {
  const db = resolveSubscriptionDb(supabase);

  const { data, error } = await db
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  let row = (data as UserSubscriptionRow | null) ?? defaultSubscriptionRow(userId);

  if (!data) {
    row = await persistSubscriptionRow(db, row);
  }

  row = await expirePremiumIfNeeded(db, row);

  if (shouldResetMonthlyUsage(row.usage_reset_at)) {
    row = applyMonthlyUsageReset(row);
    row = await persistSubscriptionRow(db, row);
  }

  return row;
}

export async function getSubscriptionView(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionView> {
  const row = await getOrCreateUserSubscription(supabase, userId);
  return toSubscriptionView(row);
}

export async function checkFeatureAccess(
  supabase: SupabaseClient,
  userId: string,
  feature: SubscriptionFeature,
): Promise<FeatureAccessResult> {
  const row = await getOrCreateUserSubscription(supabase, userId);
  return evaluateFeatureAccess(row, feature);
}

export async function consumeFeatureUsage(
  supabase: SupabaseClient,
  userId: string,
  feature: SubscriptionFeature,
): Promise<UserSubscriptionRow> {
  const db = resolveSubscriptionDb(supabase);
  const access = await checkFeatureAccess(supabase, userId, feature);
  if (!access.allowed) {
    throw new Error(access.message);
  }

  if (isPremiumActive(access.subscription)) {
    return access.subscription;
  }

  if (feature !== "report_simplification" && feature !== "symptom_analysis") {
    return access.subscription;
  }

  const incremented = incrementUsageCount(access.subscription, feature);
  return persistSubscriptionRow(db, incremented);
}

export async function activatePremiumSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionView> {
  const db = resolveSubscriptionDb(supabase);
  const existing = await getOrCreateUserSubscription(supabase, userId);
  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + PREMIUM_DURATION_DAYS);

  const updated: UserSubscriptionRow = {
    ...existing,
    plan: "premium",
    subscription_status: "active",
    subscription_start_date: now.toISOString(),
    subscription_end_date: end.toISOString(),
  };

  const saved = await persistSubscriptionRow(db, updated);
  return toSubscriptionView(saved);
}

export async function cancelPremiumSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionView> {
  const db = resolveSubscriptionDb(supabase);
  const existing = await getOrCreateUserSubscription(supabase, userId);
  const updated: UserSubscriptionRow = {
    ...existing,
    plan: "free",
    subscription_status: "canceled",
    subscription_end_date: new Date().toISOString(),
  };
  const saved = await persistSubscriptionRow(db, updated);
  return toSubscriptionView(saved);
}

export async function adminResetSubscriptionToFree(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionView> {
  const db = resolveSubscriptionDb(supabase);
  const existing = await getOrCreateUserSubscription(supabase, userId);
  const updated: UserSubscriptionRow = {
    ...existing,
    plan: "free",
    subscription_status: "inactive",
    subscription_start_date: null,
    subscription_end_date: null,
    report_simplification_used_this_month: 0,
    symptom_analysis_used_this_month: 0,
  };
  const saved = await persistSubscriptionRow(db, updated);
  return toSubscriptionView(saved);
}
