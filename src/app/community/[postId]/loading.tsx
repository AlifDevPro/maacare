"use client";

import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { PostDetailSkeleton } from "./post-detail-skeleton";

export default function PostDetailLoading() {
  const { t } = useTranslation("health");
  return (
    <AppShell>
      <AppHeader title={t("community_post_title")} showBack showNotifications />
      <PostDetailSkeleton />
    </AppShell>
  );
}
