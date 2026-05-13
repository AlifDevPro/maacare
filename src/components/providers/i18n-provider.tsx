"use client";

import { I18nextProvider } from "react-i18next";
import { useLayoutEffect, useSyncExternalStore } from "react";

import { useUser } from "@/lib/auth-client";
import i18n, { setHtmlLang } from "@/lib/i18n/i18n";
import {
  getGuestLanguageOrDefault,
  subscribeGuestLanguage,
} from "@/lib/i18n/guest-language";

import { useInitialLanguageFromServer } from "./initial-language-from-server";

function guestLanguageServerSnapshot() {
  return "en" as const;
}

function guestLanguageClientSnapshot() {
  return getGuestLanguageOrDefault();
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const serverLng = useInitialLanguageFromServer();
  const guestLng = useSyncExternalStore(
    subscribeGuestLanguage,
    guestLanguageClientSnapshot,
    guestLanguageServerSnapshot,
  );
  const effective = user?.language ?? serverLng ?? guestLng ?? "en";

  useLayoutEffect(() => {
    if (i18n.language !== effective) {
      void i18n.changeLanguage(effective);
    }
    setHtmlLang(effective);
  }, [effective]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
