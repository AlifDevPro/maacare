"use client";

import { createContext, useContext, type ReactNode } from "react";

const InitialLanguageContext = createContext<"en" | "bn" | undefined>(undefined);

/** RSC pages that already resolved `session.language` can wrap children so i18n matches before the session query resolves. */
export function InitialLanguageFromServer({
  value,
  children,
}: {
  value: "en" | "bn";
  children: ReactNode;
}) {
  return <InitialLanguageContext.Provider value={value}>{children}</InitialLanguageContext.Provider>;
}

export function useInitialLanguageFromServer() {
  return useContext(InitialLanguageContext);
}
