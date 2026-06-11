import assert from "node:assert/strict";

import {
  buildQuota,
  evaluateFeatureAccess,
  isPremiumActive,
  toSubscriptionView,
} from "../src/lib/subscription/access";
import { FREE_MONTHLY_LIMIT } from "../src/lib/subscription/constants";
import {
  applyMonthlyUsageReset,
  incrementUsageCount,
  shouldResetMonthlyUsage,
  startOfUtcMonth,
} from "../src/lib/subscription/usage";
import type { UserSubscriptionRow } from "../src/lib/subscription/types";

function baseRow(overrides: Partial<UserSubscriptionRow> = {}): UserSubscriptionRow {
  const now = new Date();
  return {
    user_id: "user-1",
    plan: "free",
    subscription_status: "inactive",
    subscription_start_date: null,
    subscription_end_date: null,
    report_simplification_used_this_month: 0,
    symptom_analysis_used_this_month: 0,
    usage_reset_at: startOfUtcMonth(now).toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...overrides,
  };
}

function testFreeReportLimit() {
  const row = baseRow({ report_simplification_used_this_month: FREE_MONTHLY_LIMIT });
  const denied = evaluateFeatureAccess(row, "report_simplification");
  assert.equal(denied.allowed, false);
  if (!denied.allowed) {
    assert.equal(denied.code, "USAGE_LIMIT_REACHED");
  }
}

function testFreeSymptomLimit() {
  const row = baseRow({ symptom_analysis_used_this_month: FREE_MONTHLY_LIMIT });
  const denied = evaluateFeatureAccess(row, "symptom_analysis");
  assert.equal(denied.allowed, false);
}

function testFreeDoctorMessagingBlocked() {
  const denied = evaluateFeatureAccess(baseRow(), "doctor_messaging");
  assert.equal(denied.allowed, false);
  if (!denied.allowed) assert.equal(denied.code, "FEATURE_LOCKED");
}

function testPremiumAllowed() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 10);
  const row = baseRow({
    plan: "premium",
    subscription_status: "active",
    subscription_start_date: new Date().toISOString(),
    subscription_end_date: end.toISOString(),
    report_simplification_used_this_month: 99,
    symptom_analysis_used_this_month: 99,
  });
  assert.equal(isPremiumActive(row), true);
  assert.equal(evaluateFeatureAccess(row, "report_simplification").allowed, true);
  assert.equal(evaluateFeatureAccess(row, "doctor_messaging").allowed, true);
  assert.equal(evaluateFeatureAccess(row, "nearby_facilities").allowed, true);
  const view = toSubscriptionView(row);
  assert.equal(view.isPremium, true);
  assert.equal(view.quotas.reportSimplification.limit, null);
}

function testMonthlyUsageReset() {
  const oldPeriod = new Date("2026-04-15T00:00:00.000Z");
  const row = baseRow({
    usage_reset_at: startOfUtcMonth(oldPeriod).toISOString(),
    report_simplification_used_this_month: 2,
    symptom_analysis_used_this_month: 1,
  });
  const now = new Date("2026-06-10T00:00:00.000Z");
  assert.equal(shouldResetMonthlyUsage(row.usage_reset_at, now), true);
  const reset = applyMonthlyUsageReset(row, now);
  assert.equal(reset.report_simplification_used_this_month, 0);
  assert.equal(reset.symptom_analysis_used_this_month, 0);
}

function testIncrementUsage() {
  const row = baseRow({ report_simplification_used_this_month: 1 });
  const next = incrementUsageCount(row, "report_simplification");
  assert.equal(next.report_simplification_used_this_month, 2);
  const quota = buildQuota(next.report_simplification_used_this_month, false);
  assert.equal(quota.remaining, 0);
}

function testExpiredPremiumRevertsAccess() {
  const row = baseRow({
    plan: "premium",
    subscription_status: "active",
    subscription_end_date: "2020-01-01T00:00:00.000Z",
  });
  assert.equal(isPremiumActive(row), false);
  assert.equal(evaluateFeatureAccess(row, "doctor_messaging").allowed, false);
}

function testPremiumWithoutEndDateIsNotActive() {
  const row = baseRow({
    plan: "premium",
    subscription_status: "active",
    subscription_start_date: new Date().toISOString(),
    subscription_end_date: null,
  });
  assert.equal(isPremiumActive(row), false);
  const view = toSubscriptionView(row);
  assert.equal(view.isPremium, false);
  assert.equal(view.plan, "free");
  assert.equal(evaluateFeatureAccess(row, "doctor_messaging").allowed, false);
}

function main() {
  testFreeReportLimit();
  testFreeSymptomLimit();
  testFreeDoctorMessagingBlocked();
  testPremiumAllowed();
  testMonthlyUsageReset();
  testIncrementUsage();
  testExpiredPremiumRevertsAccess();
  testPremiumWithoutEndDateIsNotActive();
  console.log("subscription-access: all checks passed");
}

main();
