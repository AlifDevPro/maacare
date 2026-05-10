"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { Phone, Navigation, Ambulance, Stethoscope, LocateFixed } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const FALLBACK_HOSPITALS = [
  { name: "City Maternity Hospital", distance: "0.8 km", phone: "+8801711000001", latitude: 23.7513, longitude: 90.3939 },
  { name: "Square Hospital — Maternity", distance: "1.4 km", phone: "+8801711000002", latitude: 23.7519, longitude: 90.3813 },
  { name: "United Hospital — OB/GYN", distance: "2.1 km", phone: "+8801711000003", latitude: 23.8041, longitude: 90.4152 },
  { name: "Apollo Women's Care", distance: "3.5 km", phone: "+8801711000004", latitude: 23.7976, longitude: 90.4226 },
];

type Hospital = {
  name: string;
  phone: string | null;
  distanceText: string | null;
  address: string | null;
  mapsUrl: string;
  latitude: number | null;
  longitude: number | null;
};

const InteractiveEmergencyMap = dynamic(
  () => import("@/components/emergency/InteractiveEmergencyMap"),
  { ssr: false },
);

export default function EmergencyPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("Detecting your location...");
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locRetrySeed, setLocRetrySeed] = useState(0);

  useEffect(() => {
    let active = true;
    let watchId: number | null = null;

    async function load() {
      if (!navigator.geolocation) {
        if (!active) return;
        setStatusText("Location unavailable. Showing nearby defaults.");
        setLocationError("Geolocation is not supported on this device.");
        setHospitals(
          FALLBACK_HOSPITALS.map((h) => ({
            name: h.name,
            phone: h.phone,
            distanceText: h.distance,
            address: null,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name)}`,
            latitude: h.latitude,
            longitude: h.longitude,
          })),
        );
        setLoading(false);
        return;
      }

      setStatusText("Waiting for your GPS location...");
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!active) return;
          setLocationError(null);
          setCurrentLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => {
          if (!active) return;
          setLocationError("Location permission denied or unavailable.");
          setStatusText("Location denied. Showing backup hospitals.");
          setHospitals(
            FALLBACK_HOSPITALS.map((h) => ({
              name: h.name,
              phone: h.phone,
              distanceText: h.distance,
              address: null,
              mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name)}`,
              latitude: h.latitude,
              longitude: h.longitude,
            })),
          );
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
      );
    }

    void load();
    return () => {
      active = false;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [locRetrySeed]);

  useEffect(() => {
    if (!currentLocation) return;
    let active = true;
    async function fetchNearby() {
      setLoading(true);
      setStatusText("Finding closest emergency hospitals...");
      try {
        const res = await fetch("/api/emergency/hospitals", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentLocation),
        });
        const data = (await res.json().catch(() => ({}))) as {
          hospitals?: Hospital[];
          message?: string;
        };
        if (!res.ok || !Array.isArray(data.hospitals) || data.hospitals.length === 0) {
          throw new Error(data.message ?? "No hospitals found.");
        }
        if (!active) return;
        setHospitals(data.hospitals);
        setStatusText(
          `${data.hospitals.length} hospitals found near your live location`,
        );
      } catch {
        if (!active) return;
        setStatusText("Using backup hospitals. Live hospital lookup temporarily unavailable.");
        setHospitals(
          FALLBACK_HOSPITALS.map((h) => ({
            name: h.name,
            phone: h.phone,
            distanceText: h.distance,
            address: null,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name)}`,
            latitude: h.latitude,
            longitude: h.longitude,
          })),
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void fetchNearby();
    return () => {
      active = false;
    };
  }, [currentLocation]);

  const displayHospitals = useMemo(
    () =>
      (hospitals.length ? hospitals : []).map((h) => ({
        ...h,
        distance: h.distanceText ?? "Nearby",
      })),
    [hospitals],
  );

  return (
    <AppShell>
      <AppHeader title="Emergency help" showBack />

      <div className="space-y-5 px-4 pt-4">
        {/* Interactive map */}
        <Card className="relative h-44 overflow-hidden border-0 shadow-card">
          <InteractiveEmergencyMap currentLocation={currentLocation} hospitals={displayHospitals} />
          <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-card/90 px-3 py-2 text-xs shadow-soft backdrop-blur">
            {loading ? "Locating nearest hospitals..." : statusText}
          </div>
        </Card>
        {locationError ? (
          <Card className="flex items-center justify-between gap-3 p-3">
            <p className="text-xs text-muted-foreground">{locationError}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() => setLocRetrySeed((s) => s + 1)}
            >
              <LocateFixed className="mr-1.5 h-3.5 w-3.5" /> Use my location
            </Button>
          </Card>
        ) : null}

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
            {displayHospitals.map((h) => (
              <Card key={h.name} className="flex items-center justify-between gap-3 p-3 shadow-soft">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{h.distance} away</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild size="icon" variant="ghost" className="h-9 w-9" disabled={!h.phone}>
                    <a href={h.phone ? `tel:${h.phone}` : "#"} aria-label={`Call ${h.name}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button asChild size="icon" variant="ghost" className="h-9 w-9">
                    <a
                      href={h.mapsUrl}
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
          className="w-full rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
