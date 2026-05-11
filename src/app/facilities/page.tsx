"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Loader2, MapPin, Navigation, Pill, Stethoscope } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Facility = {
  name: string;
  mapsUrl: string;
  phone: string | null;
  address: string | null;
  distanceText: string | null;
  latitude: number | null;
  longitude: number | null;
};

export default function FacilitiesPage() {
  const [preset, setPreset] = useState<"emergency" | "pharmacy">("pharmacy");
  const [items, setItems] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrySeed, setRetrySeed] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      setItems([]);

      if (!navigator.geolocation) {
        if (!cancelled) {
          setError("Location is not supported on this device.");
          setLoading(false);
        }
        return;
      }

      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
        );
      });

      if (cancelled) return;
      if (!pos) {
        setError("Allow location to see nearest facilities from your dataset.");
        setLoading(false);
        return;
      }

      const { latitude, longitude } = pos.coords;

      try {
        const res = await fetch("/api/facilities/nearby", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude,
            longitude,
            preset,
            limit: 25,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          facilities?: Facility[];
          message?: string;
        };
        if (!res.ok) {
          throw new Error(data.message ?? "Could not load facilities.");
        }
        if (!cancelled) setItems(Array.isArray(data.facilities) ? data.facilities : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Request failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [preset, retrySeed]);

  return (
    <AppShell>
      <AppHeader title="Nearby facilities" showBack />

      <div className="space-y-4 px-4 pt-4">
        <p className="text-xs text-muted-foreground">
          Uses your imported Bangladesh OSM points (hospitals, clinics, pharmacies). No AI — fast
          and quota-free.
        </p>

        <div className="flex gap-2 rounded-xl border border-border/70 bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setPreset("pharmacy")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              preset === "pharmacy" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Pill className="h-4 w-4" /> Pharmacies
          </button>
          <button
            type="button"
            onClick={() => setPreset("emergency")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              preset === "emergency" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Stethoscope className="h-4 w-4" /> Hospitals & clinics
          </button>
        </div>

        {error ? (
          <Card className="p-3 text-sm text-destructive">
            {error}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 rounded-lg"
              onClick={() => setRetrySeed((s) => s + 1)}
            >
              Retry location
            </Button>
          </Card>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading nearest matches…</span>
          </div>
        ) : !error && items.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            No rows returned. Apply Supabase migrations, run{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run import-bd-facilities</code> with your
            GeoJSON file, then refresh.
          </Card>
        ) : (
          <ul className="space-y-2">
            {items.map((f) => (
              <Card key={`${f.name}-${f.mapsUrl}`} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{f.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {f.distanceText ?? "Nearby"}
                  </p>
                  {f.address ? <p className="mt-1 text-xs text-muted-foreground">{f.address}</p> : null}
                </div>
                <Button asChild size="icon" variant="ghost" className="h-9 w-9 shrink-0">
                  <a href={f.mapsUrl} target="_blank" rel="noreferrer" aria-label={`Open ${f.name} in Maps`}>
                    <Navigation className="h-4 w-4" />
                  </a>
                </Button>
              </Card>
            ))}
          </ul>
        )}

        <p className="text-center text-[11px] text-muted-foreground">
          For AI-assisted emergency suggestions, use{" "}
          <Link href="/emergency" className="text-primary underline-offset-2 hover:underline">
            Emergency
          </Link>
          .
        </p>
      </div>
    </AppShell>
  );
}
