"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Suspense, useMemo } from "react";

import { CheckCircle2, MessageCircle, MapPin, Shield } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { z } from "zod";

const search = z.object({
  level: z.enum(["low", "medium", "high"]).default("low"),
  count: z.coerce.number().default(0),
  severity: z.coerce.number().default(1),
});

const COPY = {
  low: {
    title: "Low Risk",
    color: "bg-risk-low text-risk-low-foreground",
    ring: "ring-risk-low-foreground/20",
    explain:
      "Your symptoms appear mild and are common during pregnancy. Keep monitoring how you feel and follow simple self-care tips.",
    tips: ["Drink 8+ glasses of water", "Rest when tired", "Eat balanced meals", "Light walking helps"],
  },
  medium: {
    title: "Medium Risk",
    color: "bg-risk-medium text-risk-medium-foreground",
    ring: "ring-risk-medium-foreground/20",
    explain:
      "Your symptoms warrant attention. Track them closely and contact your doctor if they worsen or persist.",
    tips: ["Call your provider within 24h", "Track symptom timing", "Avoid strenuous activity", "Stay hydrated"],
  },
  high: {
    title: "High Risk",
    color: "bg-risk-high text-risk-high-foreground",
    ring: "ring-risk-high-foreground/30",
    explain:
      "Your symptoms could indicate a serious condition. Please seek medical care immediately.",
    tips: ["Call your doctor now", "Or go to the nearest hospital", "Do not drive yourself", "Bring a support person"],
  },
} as const;

function SymptomsResultFallback() {
  return (
    <AppShell>
      <AppHeader title="Your risk level" showBack />
      <div className="flex justify-center px-4 pt-12 text-sm text-muted-foreground">Loading…</div>
    </AppShell>
  );
}

function SymptomsResultInner() {
  const searchParams = useSearchParams();

  const { level } = useMemo(() => {
    const parsed = search.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : search.parse({});
  }, [searchParams]);

  const c = COPY[level as keyof typeof COPY];

  return (
    <AppShell>
      <AppHeader title="Your risk level" showBack />

      <div className="space-y-5 px-4 pt-4">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
        >
          <Card className={`overflow-hidden border-0 ${c.color} ring-4 ${c.ring} shadow-card`}>
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card/40 backdrop-blur">
                <Shield className="h-7 w-7" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80">AI assessment</p>
              <h1 className="font-display text-3xl font-semibold tracking-tight">{c.title}</h1>
              <p className="max-w-[28ch] text-sm leading-relaxed opacity-90">{c.explain}</p>
            </div>
          </Card>
        </motion.div>

        <Card className="p-4 shadow-soft">
          <h2 className="mb-3 font-display text-sm font-semibold">Recommended next steps</h2>
          <ul className="space-y-2.5">
            {c.tips.map((t: string) => (
              <li key={t} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href="/chat">
              <MessageCircle className="mr-1.5 h-4 w-4" />
              Chat with AI
            </Link>
          </Button>
          <Button asChild className="rounded-2xl shadow-soft">
            <Link href="/emergency">
              <MapPin className="mr-1.5 h-4 w-4" />
              Find hospital
            </Link>
          </Button>
        </div>

        <p className="px-2 text-center text-[11px] text-muted-foreground">
          AI guidance only — not a medical diagnosis. Always consult your doctor.
        </p>
      </div>
    </AppShell>
  );
}

export default function SymptomsResultPage() {
  return (
    <Suspense fallback={<SymptomsResultFallback />}>
      <SymptomsResultInner />
    </Suspense>
  );
}
