import { checkFeatureAccess, consumeFeatureUsage } from "@/lib/subscription/repository";
import { subscriptionPaywallResponse } from "@/lib/subscription/paywall-response";
import type { SubscriptionFeature } from "@/lib/subscription/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EnforceResult =
  | { ok: true }
  | { ok: false; response: ReturnType<typeof subscriptionPaywallResponse> };

export async function enforceSubscriptionFeature(
  userId: string,
  feature: SubscriptionFeature,
): Promise<EnforceResult> {
  const supabase = await createSupabaseServerClient();
  const access = await checkFeatureAccess(supabase, userId, feature);
  if (!access.allowed) {
    return { ok: false, response: subscriptionPaywallResponse(access) };
  }
  return { ok: true };
}

export async function enforceAndConsumeSubscriptionFeature(
  userId: string,
  feature: SubscriptionFeature,
): Promise<EnforceResult> {
  const gate = await enforceSubscriptionFeature(userId, feature);
  if (!gate.ok) return gate;

  const supabase = await createSupabaseServerClient();
  await consumeFeatureUsage(supabase, userId, feature);
  return { ok: true };
}
