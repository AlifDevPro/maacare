"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { isSubscriptionPaywallError } from "@/lib/subscription/access";
import { useSubscription } from "@/lib/subscription/use-subscription";
import { Button } from "@/components/ui/button";

export default function DmStartClient() {
  const { t } = useTranslation("messages");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bad, setBad] = useState(false);
  const [locked, setLocked] = useState(false);
  const { openPaywall } = useSubscription();

  useEffect(() => {
    const peer = searchParams.get("peer")?.trim() ?? "";
    if (!peer) {
      setBad(true);
      toast.error(t("toast_pick_member"));
      router.replace("/messages");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/dm/conversations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerUserId: peer }),
        });
        const j = (await res.json().catch(() => ({}))) as { conversationId?: string; message?: string };
        if (!res.ok) {
          if (res.status === 403 && isSubscriptionPaywallError(j)) {
            if (!cancelled) {
              setLocked(true);
              openPaywall("doctor_messaging");
            }
            return;
          }
          throw new Error(j.message ?? t("toast_start_chat"));
        }
        const id = j.conversationId;
        if (!id) throw new Error(t("toast_start_chat"));
        if (!cancelled) router.replace(`/messages/${id}`);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : t("toast_start_chat"));
          router.replace("/messages");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams, t]);

  return (
    <AppShell>
      <AppHeader title={t("inbox_title")} showBack backHref="/messages" showNotifications />
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-sm text-muted-foreground">
        {locked ? (
          <div className="max-w-sm space-y-3 text-center">
            <p className="font-medium text-foreground">Premium is required to message verified doctors.</p>
            <p className="text-xs">You can still message other community members for free.</p>
            <Button className="rounded-xl" onClick={() => openPaywall("doctor_messaging")}>
              Upgrade to Premium
            </Button>
            <Link href="/messages" className="block text-sm font-medium text-primary">
              {t("back_to_inbox")}
            </Link>
          </div>
        ) : !bad ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>{t("opening_conversation")}</p>
          </>
        ) : (
          <Link href="/messages" className="font-medium text-primary">
            {t("back_to_inbox")}
          </Link>
        )}
      </div>
    </AppShell>
  );
}
