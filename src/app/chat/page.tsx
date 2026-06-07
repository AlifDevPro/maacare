"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { ChatPageClient } from "@/components/chat/chat-page-client";

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatPageLoading />}>
      <ChatPageClient />
    </Suspense>
  );
}

function ChatPageLoading() {
  return (
    <AppShell wide>
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  );
}
