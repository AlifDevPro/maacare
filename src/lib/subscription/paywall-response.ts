import { NextResponse } from "next/server";

import { toSubscriptionView } from "@/lib/subscription/access";
import { PAYWALL_MESSAGE } from "@/lib/subscription/constants";
import type { FeatureAccessResult } from "@/lib/subscription/types";

export function subscriptionPaywallResponse(access: Extract<FeatureAccessResult, { allowed: false }>) {
  const view = toSubscriptionView(access.subscription);
  return NextResponse.json(
    {
      error: "subscription_required",
      message: PAYWALL_MESSAGE,
      code: access.code,
      feature: access.feature,
      plan: view.plan,
      subscription: view,
    },
    { status: 403 },
  );
}
