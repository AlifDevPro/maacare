"use client";

import { useState } from "react";

import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [sending, setSending] = useState(false);

  async function report() {
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "error",
          message: [error.message, error.digest ? `digest:${error.digest}` : null].filter(Boolean).join("\n"),
          context: {
            stack: error.stack?.slice(0, 4000),
            path: typeof window !== "undefined" ? window.location.href : undefined,
          },
        }),
      });
      if (res.status === 401) {
        toast.error("Sign in to send a report, or try again later.");
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? "Could not send");
      }
      toast.success("Thanks — we received your report.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send report");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-600" aria-hidden />
      <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred. You can retry or send us a short report."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" variant="outline" disabled={sending} onClick={() => void report()}>
          {sending ? "Sending…" : "Report to team"}
        </Button>
      </div>
    </div>
  );
}
