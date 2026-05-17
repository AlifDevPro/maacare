"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, type ReactNode } from "react";

import {
  AUTH_EVENT,
  authSessionQueryKey,
  authSessionQueryOptions,
} from "@/lib/auth/session-query";
import type { AuthUser } from "@/lib/auth/types";

type SessionContextValue = {
  user: AuthUser | null;
  loading: boolean;
};

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
});

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

/** Must render inside QueryClientProvider (see RootProviders). */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const query = useQuery(authSessionQueryOptions());

  return (
    <SessionContext.Provider
      value={{
        user: query.data ?? null,
        loading: query.isPending,
      }}
    >
      <AuthSessionInvalidator />
      {children}
    </SessionContext.Provider>
  );
}

export function useAuthSession(): SessionContextValue {
  return useContext(SessionContext);
}
