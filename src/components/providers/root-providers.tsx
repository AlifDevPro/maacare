"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";

import { Toaster } from "@/components/ui/sonner";
import { getQueryClient } from "@/lib/get-query-client";
import { applyTheme, getTheme } from "@/lib/theme";

import { SubscriptionProvider } from "@/lib/subscription/subscription-context";

import { AuthSessionProvider } from "./auth-session-provider";
import { I18nProvider } from "./i18n-provider";

/** Root providers: React Query + session + i18n + theme. */
export function RootProviders({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>
        <I18nProvider>
          <SubscriptionProvider>{children}</SubscriptionProvider>
        </I18nProvider>
        <Toaster position="top-center" />
      </AuthSessionProvider>
    </QueryClientProvider>
  );
}
