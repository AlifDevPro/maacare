"use client";
import { useState } from "react";
import Link from "next/link";

import { Upload, FileText, Sparkles, Save, MessageCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ReportsPage() {
  const [analyzed, setAnalyzed] = useState(false);

  return (
    <AppShell>
      <AppHeader title="Understand your report" showBack />
      <div className="space-y-5 px-4 pt-4">
        {!analyzed ? (
          <>
            <Card className="border-2 border-dashed border-border bg-muted/40 p-8 text-center shadow-soft">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Upload className="h-6 w-6" />
              </div>
              <h2 className="font-display text-base font-semibold">Upload your medical report</h2>
              <p className="mt-1 text-xs text-muted-foreground">PDF or image, up to 10 MB</p>
              <Button onClick={() => setAnalyzed(true)} className="mt-4 rounded-2xl shadow-soft">
                <FileText className="mr-1.5 h-4 w-4" /> Choose file
              </Button>
            </Card>
            <p className="px-2 text-center text-[11px] text-muted-foreground">
              Your reports are encrypted and visible only to you.
            </p>
          </>
        ) : (
          <>
            <Card className="overflow-hidden border-0 bg-gradient-warm p-5 shadow-card">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary/80">
                <Sparkles className="h-3.5 w-3.5" /> AI summary
              </div>
              <p className="mt-2 text-sm leading-relaxed">
                Your hemoglobin level is <strong>slightly low</strong> for this stage. Other values
                look normal. Discuss iron supplementation with your doctor.
              </p>
            </Card>

            <div>
              <h2 className="mb-2 font-display text-sm font-semibold">Key values</h2>
              <div className="space-y-2">
                <ValueRow name="Hemoglobin" value="10.2 g/dL" range="11.0–14.0" status="low" />
                <ValueRow name="Blood pressure" value="118/76" range="< 130/85" status="normal" />
                <ValueRow name="Glucose" value="92 mg/dL" range="< 95" status="normal" />
                <ValueRow name="Iron" value="55 µg/dL" range="60–170" status="low" />
              </div>
            </div>

            <Card className="p-4 shadow-soft">
              <h3 className="font-display text-sm font-semibold">Plain-language explanation</h3>
              <p className="mt-1 text-sm text-foreground/90">
                Mild anemia is common in pregnancy. Iron-rich foods (spinach, lentils, lean meat)
                and a doctor-approved supplement usually correct it.
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/chat">
                  <MessageCircle className="mr-1.5 h-4 w-4" /> Ask AI
                </Link>
              </Button>
              <Button className="rounded-2xl shadow-soft">
                <Save className="mr-1.5 h-4 w-4" /> Save report
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ValueRow({
  name,
  value,
  range,
  status,
}: {
  name: string;
  value: string;
  range: string;
  status: "normal" | "low" | "high";
}) {
  const map = {
    normal: { color: "bg-risk-low text-risk-low-foreground", icon: CheckCircle2, label: "Normal" },
    low: { color: "bg-risk-medium text-risk-medium-foreground", icon: AlertCircle, label: "Low" },
    high: { color: "bg-risk-high text-risk-high-foreground", icon: AlertCircle, label: "High" },
  } as const;
  const s = map[status];
  return (
    <Card className="flex items-center justify-between p-3 shadow-soft">
      <div>
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">Normal: {range}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{value}</span>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.color}`}>
          <s.icon className="h-3 w-3" />
          {s.label}
        </span>
      </div>
    </Card>
  );
}
