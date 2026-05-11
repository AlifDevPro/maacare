"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { format } from "date-fns";
import {
  Activity,
  Droplets,
  Gauge,
  HeartPulse,
  Loader2,
  Thermometer,
  Weight,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { VitalListItem } from "@/lib/app/user-lists-data";

function tinySparkline(values: number[]) {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - ((v - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return points;
}

export function VitalsPageClient({ initialItems }: { initialItems: VitalListItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<VitalListItem[]>(initialItems);

  const [systolicBp, setSystolicBp] = useState("");
  const [diastolicBp, setDiastolicBp] = useState("");
  const [heartRateBpm, setHeartRateBpm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [temperatureC, setTemperatureC] = useState("");
  const [glucoseMgDl, setGlucoseMgDl] = useState("");
  const [spo2Pct, setSpo2Pct] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const latest = items[0] ?? null;
  const hrSeries = useMemo(
    () => items.map((x) => x.heartRateBpm).filter((v): v is number => v != null).slice(0, 8).reverse(),
    [items],
  );
  const bpSeries = useMemo(
    () =>
      items
        .map((x) => (x.systolicBp != null && x.diastolicBp != null ? x.systolicBp : null))
        .filter((v): v is number => v != null)
        .slice(0, 8)
        .reverse(),
    [items],
  );
  const tempSeries = useMemo(
    () => items.map((x) => x.temperatureC).filter((v): v is number => v != null).slice(0, 8).reverse(),
    [items],
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/vitals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systolicBp: systolicBp ? Number(systolicBp) : undefined,
          diastolicBp: diastolicBp ? Number(diastolicBp) : undefined,
          heartRateBpm: heartRateBpm ? Number(heartRateBpm) : undefined,
          weightKg: weightKg ? Number(weightKg) : undefined,
          temperatureC: temperatureC ? Number(temperatureC) : undefined,
          glucoseMgDl: glucoseMgDl ? Number(glucoseMgDl) : undefined,
          spo2Pct: spo2Pct ? Number(spo2Pct) : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { vital?: VitalListItem; message?: string };
      if (!res.ok || !j.vital) throw new Error(j.message ?? "Could not save vitals");
      toast.success("Vitals logged");
      setItems((prev) => [j.vital!, ...prev]);
      startTransition(() => router.refresh());
      setSystolicBp("");
      setDiastolicBp("");
      setHeartRateBpm("");
      setWeightKg("");
      setTemperatureC("");
      setGlucoseMgDl("");
      setSpo2Pct("");
      setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save vitals");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <AppHeader title="Vitals dashboard" showBack showNotifications />
      <div className="space-y-4 px-4 pt-4">
        <Card className="p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="font-display text-base font-semibold">Today at a glance</h1>
            <span className="text-xs text-muted-foreground">
              {latest ? format(new Date(latest.recordedAt), "MMM d, hh:mm a") : "No records"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <VitalTile
              icon={HeartPulse}
              label="Heart rate"
              value={latest?.heartRateBpm != null ? `${latest.heartRateBpm} bpm` : "—"}
              spark={tinySparkline(hrSeries)}
            />
            <VitalTile
              icon={Activity}
              label="Blood pressure"
              value={
                latest?.systolicBp != null && latest?.diastolicBp != null
                  ? `${latest.systolicBp}/${latest.diastolicBp}`
                  : "—"
              }
              spark={tinySparkline(bpSeries)}
            />
            <VitalTile
              icon={Thermometer}
              label="Temperature"
              value={latest?.temperatureC != null ? `${latest.temperatureC} °C` : "—"}
              spark={tinySparkline(tempSeries)}
            />
            <VitalTile
              icon={Droplets}
              label="SpO₂"
              value={latest?.spo2Pct != null ? `${latest.spo2Pct}%` : "—"}
            />
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h2 className="mb-3 font-display text-base font-semibold">Log new vitals</h2>
          <form className="grid gap-2.5" onSubmit={(e) => void save(e)}>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label>Systolic BP</Label>
                <Input value={systolicBp} onChange={(e) => setSystolicBp(e.target.value)} type="number" placeholder="120" />
              </div>
              <div>
                <Label>Diastolic BP</Label>
                <Input value={diastolicBp} onChange={(e) => setDiastolicBp(e.target.value)} type="number" placeholder="80" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label>Heart rate (bpm)</Label>
                <Input value={heartRateBpm} onChange={(e) => setHeartRateBpm(e.target.value)} type="number" placeholder="78" />
              </div>
              <div>
                <Label>Weight (kg)</Label>
                <Input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} type="number" placeholder="62.4" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <Label>Temp (°C)</Label>
                <Input value={temperatureC} onChange={(e) => setTemperatureC(e.target.value)} type="number" placeholder="36.8" />
              </div>
              <div>
                <Label>SpO₂ (%)</Label>
                <Input value={spo2Pct} onChange={(e) => setSpo2Pct(e.target.value)} type="number" placeholder="98" />
              </div>
              <div>
                <Label>Glucose</Label>
                <Input value={glucoseMgDl} onChange={(e) => setGlucoseMgDl(e.target.value)} type="number" placeholder="95" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[70px]" placeholder="Optional note" />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save vitals
            </Button>
          </form>
        </Card>

        <Card className="p-5 shadow-soft">
          <h2 className="mb-2 font-display text-base font-semibold">Recent entries</h2>
          {isPending ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vitals logged yet.</p>
          ) : (
            <div className="space-y-2">
              {items.slice(0, 8).map((v) => (
                <div key={v.id} className="rounded-xl border border-border/60 p-2.5 text-xs">
                  <div className="mb-1 flex items-center justify-between text-muted-foreground">
                    <span>{format(new Date(v.recordedAt), "MMM d, yyyy · hh:mm a")}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-foreground/90">
                    <Tag icon={Activity} text={v.systolicBp != null && v.diastolicBp != null ? `${v.systolicBp}/${v.diastolicBp}` : "BP —"} />
                    <Tag icon={HeartPulse} text={v.heartRateBpm != null ? `${v.heartRateBpm} bpm` : "HR —"} />
                    <Tag icon={Thermometer} text={v.temperatureC != null ? `${v.temperatureC}°C` : "Temp —"} />
                    <Tag icon={Droplets} text={v.spo2Pct != null ? `${v.spo2Pct}%` : "SpO₂ —"} />
                    <Tag icon={Weight} text={v.weightKg != null ? `${v.weightKg} kg` : "Wt —"} />
                    <Tag icon={Gauge} text={v.glucoseMgDl != null ? `${v.glucoseMgDl} mg/dL` : "Glucose —"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function VitalTile({
  icon: Icon,
  label,
  value,
  spark,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  spark?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-display text-lg font-semibold">{value}</p>
      {spark ? (
        <svg viewBox="0 0 100 100" className="mt-1 h-8 w-full">
          <polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-primary" points={spark} />
        </svg>
      ) : (
        <div className="mt-1 h-8 w-full rounded bg-muted/40" />
      )}
    </div>
  );
}

function Tag({ icon: Icon, text }: { icon: typeof Activity; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      {text}
    </span>
  );
}

