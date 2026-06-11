"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { PaywallModal } from "@/components/subscription/paywall-modal";
import { useAuthSession } from "@/components/providers/auth-session-provider";
import { AUTH_EVENT } from "@/lib/auth/session-query";
import { isSubscriptionPaywallError } from "@/lib/subscription/access";
import { defaultFreeSubscriptionView } from "@/lib/subscription/default-view";
import type { SubscriptionFeature, SubscriptionView } from "@/lib/subscription/types";

type SubscriptionContextValue = {
  subscription: SubscriptionView;
  displaySubscription: SubscriptionView;
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

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuthSession();
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [subscriptionFetching, setSubscriptionFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<SubscriptionFeature | null>(null);

  const loading = authLoading || subscriptionFetching;
  const displaySubscription = subscription ?? defaultFreeSubscriptionView();

  const refresh = useCallback(async () => {
    if (authLoading) return;

    if (!user) {
      setSubscription(null);
      setError(null);
      setSubscriptionFetching(false);
      return;
    }

    setSubscriptionFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/subscription", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        subscription?: SubscriptionView;
        message?: string;
        code?: string;
      };
      if (res.status === 401) {
        setSubscription(null);
        setError(data.message ?? "Sign in to view your subscription.");
        return;
      }
      if (!res.ok) {
        throw new Error(data.message ?? "Could not load subscription.");
      }
      setSubscription(data.subscription ?? defaultFreeSubscriptionView());
    } catch (e) {
      setSubscription(null);
      setError(e instanceof Error ? e.message : "Could not load subscription.");
    } finally {
      setSubscriptionFetching(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading) {
      setSubscriptionFetching(true);
      return;
    }
    void refresh();
  }, [authLoading, user?.id, refresh]);

  useEffect(() => {
    const onAuth = () => {
      void refresh();
    };
    window.addEventListener(AUTH_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_EVENT, onAuth);
  }, [refresh]);

  const openPaywall = useCallback((feature?: SubscriptionFeature | null) => {
    setPaywallFeature(feature ?? null);
    setPaywallOpen(true);
  }, []);

  const closePaywall = useCallback(() => {
    setPaywallOpen(false);
    setPaywallFeature(null);
  }, []);

  const upgrade = useCallback(async () => {
    setUpgrading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscription/upgrade", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "mock" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        subscription?: SubscriptionView;
        message?: string;
      };
      if (!res.ok) throw new Error(data.message ?? "Upgrade failed.");
      if (data.subscription) setSubscription(data.subscription);
      closePaywall();
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upgrade failed.";
      setError(message);
      return { ok: false, message };
    } finally {
      setUpgrading(false);
    }
  }, [closePaywall]);

  const handleApiResponse = useCallback(
    (res: Response, data: unknown) => {
      if (res.status === 403 && isSubscriptionPaywallError(data)) {
        openPaywall((data as { feature?: SubscriptionFeature }).feature ?? null);
        void refresh();
        return true;
      }
      return false;
    },
    [openPaywall, refresh],
  );

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      subscription: displaySubscription,
      displaySubscription,
      loading,
      error,
      upgrading,
      refresh,
      upgrade,
      openPaywall,
      paywallOpen,
      paywallFeature,
      closePaywall,
      handleApiResponse,
    }),
    [
      displaySubscription,
      loading,
      error,
      upgrading,
      refresh,
      upgrade,
      openPaywall,
      paywallOpen,
      paywallFeature,
      closePaywall,
      handleApiResponse,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <PaywallModal
        open={paywallOpen}
        onOpenChange={(open) => {
          if (!open) closePaywall();
        }}
        feature={paywallFeature}
        upgrading={upgrading}
        onUpgrade={upgrade}
      />
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscriptionContext must be used within SubscriptionProvider");
  }
  return ctx;
}
