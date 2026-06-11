"use client";

import type { ReactNode } from "react";

import { PaywallModal } from "@/components/subscription/paywall-modal";
import { useSubscription } from "@/lib/subscription/use-subscription";

type SubscriptionShellProps = {
  children: (ctx: ReturnType<typeof useSubscription>) => ReactNode;
};

export function SubscriptionShell({ children }: SubscriptionShellProps) {
  const ctx = useSubscription();

  return (
    <>
      {children(ctx)}
      <PaywallModal
        open={ctx.paywallOpen}
        onOpenChange={(open) => {
          if (!open) ctx.closePaywall();
        }}
        feature={ctx.paywallFeature}
        upgrading={ctx.upgrading}
        onUpgrade={ctx.upgrade}
      />
    </>
  );
}
