import { CalendarClock, EyeOff } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { DocsWindowState } from "@/lib/docs-runtime/types";

export function DocsUnavailable({ publication }: { publication: DocsWindowState }) {
  return (
    <Card className="space-y-4 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
        <EyeOff className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="font-display text-2xl font-semibold">Docs are currently unavailable</h1>
      <p className="mx-auto max-w-xl text-sm text-muted-foreground">
        The documentation is outside the active publication window or temporarily disabled by admins.
      </p>
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-left text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          <span>Publication schedule</span>
        </div>
        <p className="mt-2">Start: {publication.startAt ? new Date(publication.startAt).toLocaleString() : "Not set"}</p>
        <p>End: {publication.endAt ? new Date(publication.endAt).toLocaleString() : "Not set"}</p>
      </div>
    </Card>
  );
}

