import type { UserSubscriptionRow } from "@/lib/subscription/types";

export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function shouldResetMonthlyUsage(usageResetAt: string, now = new Date()): boolean {
  const resetAt = new Date(usageResetAt);
  if (Number.isNaN(resetAt.getTime())) return true;
  return startOfUtcMonth(now).getTime() > startOfUtcMonth(resetAt).getTime();
}

export function nextUsageResetAt(now = new Date()): string {
  return startOfUtcMonth(now).toISOString();
}

export function applyMonthlyUsageReset(row: UserSubscriptionRow, now = new Date()): UserSubscriptionRow {
  if (!shouldResetMonthlyUsage(row.usage_reset_at, now)) return row;
  return {
    ...row,
    report_simplification_used_this_month: 0,
    symptom_analysis_used_this_month: 0,
    usage_reset_at: nextUsageResetAt(now),
  };
}

export function getUsageCount(row: UserSubscriptionRow, feature: "report_simplification" | "symptom_analysis"): number {
  if (feature === "report_simplification") return row.report_simplification_used_this_month;
  return row.symptom_analysis_used_this_month;
}

export function incrementUsageCount(
  row: UserSubscriptionRow,
  feature: "report_simplification" | "symptom_analysis",
): UserSubscriptionRow {
  if (feature === "report_simplification") {
    return {
      ...row,
      report_simplification_used_this_month: row.report_simplification_used_this_month + 1,
    };
  }
  return {
    ...row,
    symptom_analysis_used_this_month: row.symptom_analysis_used_this_month + 1,
  };
}
