import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import adminBn from "@/messages/bn/admin.json";
import authBn from "@/messages/bn/auth.json";
import commonBn from "@/messages/bn/common.json";
import communityBn from "@/messages/bn/community.json";
import healthBn from "@/messages/bn/health.json";
import homeBn from "@/messages/bn/home.json";
import marketingBn from "@/messages/bn/marketing.json";
import messagesBn from "@/messages/bn/messages.json";
import navBn from "@/messages/bn/nav.json";
import shellBn from "@/messages/bn/shell.json";
import adminEn from "@/messages/en/admin.json";
import authEn from "@/messages/en/auth.json";
import commonEn from "@/messages/en/common.json";
import communityEn from "@/messages/en/community.json";
import healthEn from "@/messages/en/health.json";
import homeEn from "@/messages/en/home.json";
import marketingEn from "@/messages/en/marketing.json";
import messagesEn from "@/messages/en/messages.json";
import navEn from "@/messages/en/nav.json";
import shellEn from "@/messages/en/shell.json";

export const defaultNamespaces = [
  "common",
  "nav",
  "shell",
  "home",
  "auth",
  "health",
  "community",
  "messages",
  "admin",
  "marketing",
] as const;

const resources = {
  en: {
    common: commonEn,
    nav: navEn,
    shell: shellEn,
    home: homeEn,
    auth: authEn,
    health: healthEn,
    community: communityEn,
    messages: messagesEn,
    admin: adminEn,
    marketing: marketingEn,
  },
  bn: {
    common: commonBn,
    nav: navBn,
    shell: shellBn,
    home: homeBn,
    auth: authBn,
    health: healthBn,
    community: communityBn,
    messages: messagesBn,
    admin: adminBn,
    marketing: marketingBn,
  },
} as const;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: "en",
    fallbackLng: "en",
    defaultNS: "common",
    ns: [...defaultNamespaces],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export function setHtmlLang(lng: string) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng === "bn" ? "bn" : "en";
  }
}

export default i18n;
