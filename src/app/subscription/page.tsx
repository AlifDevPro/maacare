"use client";

import { useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { SubscriptionDashboard } from "@/components/subscription/subscription-dashboard";
import { useSubscription } from "@/lib/subscription/use-subscription";
import { useTranslation } from "react-i18next";

export default function SubscriptionPage() {
  const { t } = useTranslation("health");
  const { upgrade, refresh } = useSubscription();
  const [success, setSuccess] = useState(false);

  async function handleUpgrade() {
    const result = await upgrade();
    if (result.ok) {
      setSuccess(true);
      await refresh();
    }
  }

  return (
    <AppShell>
      <AppHeader title={t("subscription_page_title")} showBack />
      <div className="px-4 pt-4 pb-8">
        <SubscriptionDashboard success={success} onUpgrade={handleUpgrade} />
      </div>
    </AppShell>
  );
}
