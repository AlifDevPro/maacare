"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";

export default function DmStartClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bad, setBad] = useState(false);

  useEffect(() => {
    const peer = searchParams.get("peer")?.trim() ?? "";
    if (!peer) {
      setBad(true);
      toast.error("Pick a member to message.");
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
        if (!res.ok) throw new Error(j.message ?? "Could not start chat");
        const id = j.conversationId;
        if (!id) throw new Error("Could not start chat");
        if (!cancelled) router.replace(`/messages/${id}`);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not start chat");
          router.replace("/messages");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <AppShell>
      <AppHeader title="Messages" showBack backHref="/messages" showNotifications />
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-sm text-muted-foreground">
        {!bad ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Opening conversation…</p>
          </>
        ) : (
          <Link href="/messages" className="font-medium text-primary">
            Back to inbox
          </Link>
        )}
      </div>
    </AppShell>
  );
}
