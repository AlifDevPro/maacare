"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Nudge = { id: string; message: string; href: string; priority: number };

function dismissKey(day: string, id: string) {
  return `maacare:nudgeDismiss:${day}:${id}`;
}

export function SmartHealthNudge({ className }: { className?: string }) {
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const serverDayRef = useRef("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/app/health-nudges", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as { nudge: Nudge | null; serverDay?: string };
      const next = j.nudge;
      const serverDay = j.serverDay ?? new Date().toISOString().slice(0, 10);
      serverDayRef.current = serverDay;
      if (!next) {
        setNudge(null);
        return;
      }
      if (typeof window === "undefined") return;
      if (sessionStorage.getItem(dismissKey(serverDay, next.id))) {
        setNudge(null);
        return;
      }
      setNudge(next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!nudge) return null;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary-soft/80 via-card to-accent-soft/40 p-4 shadow-soft",
        className,
      )}
    >
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="absolute right-1 top-1 h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
        aria-label="Dismiss for today"
        onClick={() => {
          const day = serverDayRef.current || new Date().toISOString().slice(0, 10);
          sessionStorage.setItem(dismissKey(day, nudge.id), "1");
          setNudge(null);
        }}
      >
        <X className="h-4 w-4" />
      </Button>
      <p className="pr-10 text-sm leading-relaxed text-foreground">{nudge.message}</p>
      <Button asChild size="sm" className="mt-3 rounded-md">
        <Link href={nudge.href}>Open</Link>
      </Button>
    </Card>
  );
}
