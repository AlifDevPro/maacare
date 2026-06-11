"use client";

import { useSubscriptionContext } from "@/lib/subscription/subscription-context";
import type { SubscriptionFeature, SubscriptionView } from "@/lib/subscription/types";

export type SubscriptionState = {
  subscription: SubscriptionView;
  loading: boolean;
  error: string | null;
  upgrading: boolean;
  refresh: () => Promise<void>;
  upgrade: () => Promise<{ ok: boolean; message?: string }>;
  openPaywall: (feature?: SubscriptionFeature | null) => void;
  paywallOpen: boolean;
  paywallFeature: SubscriptionFeature | null;
  closePaywall: () => void;
  handleApiResponse: (res: Response, data: unknown) => boolean;
};

export function useSubscription(): SubscriptionState {
  const ctx = useSubscriptionContext();
  return {
    subscription: ctx.displaySubscription,
    loading: ctx.loading,
    error: ctx.error,
    upgrading: ctx.upgrading,
    refresh: ctx.refresh,
    upgrade: ctx.upgrade,
    openPaywall: ctx.openPaywall,
    paywallOpen: ctx.paywallOpen,
    paywallFeature: ctx.paywallFeature,
    closePaywall: ctx.closePaywall,
    handleApiResponse: ctx.handleApiResponse,
  };
}
