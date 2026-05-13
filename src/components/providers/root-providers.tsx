"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Toaster } from "@/components/ui/sonner";
import { AUTH_EVENT, authSessionQueryKey } from "@/lib/auth-client";
import { applyTheme, getTheme } from "@/lib/theme";

function AuthSessionInvalidator() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const onAuth = () => {
      void queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
    };
    window.addEventListener(AUTH_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_EVENT, onAuth);
  }, [queryClient]);
  return null;
}

/** Matches TanStack root: react-query plus initial theme hydration from localStorage. */
export function RootProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionInvalidator />
      {children}
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
