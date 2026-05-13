"use client";

import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { MemberProfileSkeleton } from "./member-profile-skeleton";

export default function MemberProfileLoading() {
  const { t } = useTranslation("health");
  return (
    <AppShell>
      <AppHeader title={t("community_member_title")} showBack backHref="/community" showNotifications />
      <MemberProfileSkeleton />
    </AppShell>
  );
}
