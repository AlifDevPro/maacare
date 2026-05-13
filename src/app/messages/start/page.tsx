"use client";

import { Suspense } from "react";
import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import DmStartClient from "./dm-start-client";

function StartFallback() {
  const { t } = useTranslation("messages");
  return (
    <AppShell>
      <AppHeader title={t("inbox_title")} showBack backHref="/messages" showNotifications />
      <div className="px-4 py-20 text-center text-sm text-muted-foreground">{t("loading")}</div>
    </AppShell>
  );
}

export default function DmStartPage() {
  return (
    <Suspense fallback={<StartFallback />}>
      <DmStartClient />
    </Suspense>
  );
}
