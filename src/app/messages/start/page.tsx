import { Suspense } from "react";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import DmStartClient from "./dm-start-client";

function StartFallback() {
  return (
    <AppShell>
      <AppHeader title="Messages" showBack backHref="/messages" showNotifications />
      <div className="px-4 py-20 text-center text-sm text-muted-foreground">Loading…</div>
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
