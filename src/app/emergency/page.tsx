"use client";
import Link from "next/link";

import { Phone, Navigation, AlertTriangle, Ambulance, Stethoscope } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const HOSPITALS = [
  { name: "City Maternity Hospital", distance: "0.8 km", phone: "+8801711000001" },
  { name: "Square Hospital — Maternity", distance: "1.4 km", phone: "+8801711000002" },
  { name: "United Hospital — OB/GYN", distance: "2.1 km", phone: "+8801711000003" },
  { name: "Apollo Women's Care", distance: "3.5 km", phone: "+8801711000004" },
];

export default function EmergencyPage() {
  return (
    <AppShell>
      <AppHeader title="Emergency help" showBack />

      <div className="space-y-5 px-4 pt-4">
        {/* Map placeholder */}
        <Card className="relative h-44 overflow-hidden border-0 shadow-card">
          <div className="absolute inset-0 bg-gradient-sage" />
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,oklch(0_0_0/0.06)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0_0_0/0.06)_1px,transparent_1px)] [background-size:24px_24px]" />
          {/* fake markers */}
          {[
            { top: "30%", left: "25%" },
            { top: "55%", left: "55%" },
            { top: "40%", left: "75%" },
            { top: "70%", left: "30%" },
          ].map((p, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ top: p.top, left: p.left }}
            >
              <span className="relative flex h-6 w-6 items-center justify-center">
                <span className="absolute h-6 w-6 animate-ping rounded-full bg-destructive/40" />
                <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-card">
                  <AlertTriangle className="h-3 w-3" />
                </span>
              </span>
            </span>
          ))}
          <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-card/90 px-3 py-2 text-xs shadow-soft backdrop-blur">
            4 hospitals nearby · interactive map in next phase
          </div>
        </Card>

        {/* Quick contacts */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="flex items-center gap-3 p-3 shadow-soft">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Ambulance className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Ambulance
              </p>
              <a href="tel:999" className="block truncate text-sm font-semibold">999</a>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-3 shadow-soft">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Stethoscope className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Doctor hotline
              </p>
              <a href="tel:16263" className="block truncate text-sm font-semibold">16263</a>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="mb-2 font-display text-sm font-semibold">Hospitals near you</h2>
          <div className="space-y-2.5">
            {HOSPITALS.map((h) => (
              <Card key={h.name} className="flex items-center justify-between gap-3 p-3 shadow-soft">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{h.distance} away</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild size="icon" variant="ghost" className="h-9 w-9">
                    <a href={`tel:${h.phone}`} aria-label={`Call ${h.name}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button asChild size="icon" variant="ghost" className="h-9 w-9">
                    <a
                      href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(h.name)}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Directions to ${h.name}`}
                    >
                      <Navigation className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Button
          asChild
          size="lg"
          className="w-full rounded-2xl bg-destructive text-destructive-foreground shadow-card hover:bg-destructive/90"
        >
          <a href="tel:999">
            <Phone className="mr-2 h-5 w-5" />
            Call Emergency · 999
          </a>
        </Button>
      </div>
    </AppShell>
  );
}
