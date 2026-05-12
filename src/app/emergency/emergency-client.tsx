"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { Phone, Navigation, Ambulance, Stethoscope, LocateFixed, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EmergencyMapPin } from "@/components/emergency/InteractiveEmergencyMap";
import type { FacilityKind } from "@/lib/emergency/facility-kind";
import { inferFacilityKindFromName } from "@/lib/emergency/facility-kind";
import {
  emergencyGeoBucketKey,
  readEmergencyByKindCache,
  writeEmergencyByKindCache,
} from "@/lib/emergency/nearby-session-cache";

const FALLBACK_HOSPITALS: Array<{
  name: string;
  distance: string;
  phone: string;
  latitude: number;
  longitude: number;
}> = [
  { name: "City Maternity Hospital", distance: "0.8 km", phone: "+8801711000001", latitude: 23.7513, longitude: 90.3939 },
  { name: "Square Hospital — Maternity", distance: "1.4 km", phone: "+8801711000002", latitude: 23.7519, longitude: 90.3813 },
  { name: "United Hospital — OB/GYN", distance: "2.1 km", phone: "+8801711000003", latitude: 23.8041, longitude: 90.4152 },
  { name: "Apollo Women's Care", distance: "3.5 km", phone: "+8801711000004", latitude: 23.7976, longitude: 90.4226 },
];

function fallbackToHospital(h: (typeof FALLBACK_HOSPITALS)[number]): Hospital {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name)}`;
  return {
    name: h.name,
    phone: h.phone,
    distanceText: h.distance,
    address: null,
    mapsUrl,
    latitude: h.latitude,
    longitude: h.longitude,
    facilityKind: inferFacilityKindFromName(h.name),
  };
}

function splitFallbackByKind(): Record<FacilityKind, Hospital[]> {
  const buckets: Record<FacilityKind, Hospital[]> = { clinic: [], hospital: [], pharmacy: [] };
  for (const raw of FALLBACK_HOSPITALS) {
    const h = fallbackToHospital(raw);
    const k = h.facilityKind ?? inferFacilityKindFromName(h.name);
    if (buckets[k].length >= 8) continue;
    buckets[k].push({ ...h, facilityKind: k });
  }
  return buckets;
}

const EMPTY_BY_KIND = (): Record<FacilityKind, Hospital[]> => ({
  clinic: [],
  hospital: [],
  pharmacy: [],
});

type Hospital = {
  name: string;
  phone: string | null;
  distanceText: string | null;
  address: string | null;
  mapsUrl: string;
  latitude: number | null;
  longitude: number | null;
  facilityKind?: FacilityKind;
};

type DisplayHospital = Hospital & {
  distance: string;
  facilityKind: FacilityKind;
  recommended: boolean;
};

const KIND_LABEL: Record<FacilityKind, string> = {
  clinic: "Clinic",
  hospital: "Hospital",
  pharmacy: "Pharmacy",
};

const SECTION_HEADING: Record<FacilityKind, string> = {
  clinic: "Clinics near you",
  hospital: "Hospitals near you",
  pharmacy: "Pharmacies near you",
};

const KIND_PLURAL_LOWER: Record<FacilityKind, string> = {
  clinic: "clinics",
  hospital: "hospitals",
  pharmacy: "pharmacies",
};

const InteractiveEmergencyMap = dynamic(
  () => import("@/components/emergency/InteractiveEmergencyMap"),
  { ssr: false },
);

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function hasCallablePhone(phone: string | null | undefined): boolean {
  return Boolean(phone && String(phone).trim());
}

function HospitalListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="flex items-center justify-between gap-3 p-3 shadow-soft">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-[72%] max-w-xs" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex shrink-0 gap-1">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function EmergencyClient() {
  const [facilityTab, setFacilityTab] = useState<FacilityKind>("clinic");
  const [byKind, setByKind] = useState<Record<FacilityKind, Hospital[]>>(EMPTY_BY_KIND);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locRetrySeed, setLocRetrySeed] = useState(0);
  const [hasLoadedNearby, setHasLoadedNearby] = useState(false);

  const locationFetchKey = useMemo(() => {
    if (!currentLocation) return null;
    // 3 decimals (~110m) avoids noisy re-fetch from small GPS jitter.
    return emergencyGeoBucketKey(currentLocation.latitude, currentLocation.longitude, 3);
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  useEffect(() => {
    let active = true;
    let watchId: number | null = null;

    async function load() {
      if (!navigator.geolocation) {
        if (!active) return;
        setLocationError("Geolocation is not supported on this device.");
        setByKind(splitFallbackByKind());
        setLoading(false);
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!active) return;
          setLocationError(null);
          const next = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setCurrentLocation((prev) => {
            if (!prev) return next;
            // Ignore tiny movement updates to prevent unnecessary reload flicker.
            if (distanceMeters(prev, next) < 80) return prev;
            return next;
          });
        },
        () => {
          if (!active) return;
          setLocationError("Location permission denied or unavailable.");
          setByKind(splitFallbackByKind());
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
    if (!currentLocation || !locationFetchKey) return;
    const cacheKey = locationFetchKey;
    let active = true;

    const cached = readEmergencyByKindCache(cacheKey);
    if (cached) {
      setByKind({
        clinic: cached.clinic as Hospital[],
        hospital: cached.hospital as Hospital[],
        pharmacy: cached.pharmacy as Hospital[],
      });
      setLoading(false);
      return;
    }

    async function fetchNearby() {
      if (!hasLoadedNearby) {
        setLoading(true);
      }
      const kinds = ["clinic", "hospital", "pharmacy"] as const;

      async function fetchCategory(category: FacilityKind): Promise<Hospital[]> {
        const res = await fetch("/api/emergency/hospitals", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...currentLocation, category }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          hospitals?: Hospital[];
          message?: string;
        };
        if (!res.ok || !Array.isArray(data.hospitals)) return [];
        return data.hospitals.slice(0, 8);
      }

      try {
        const settled = await Promise.all(
          kinds.map((category) => fetchCategory(category).catch(() => [] as Hospital[])),
        );
        if (!active) return;
        const next: Record<FacilityKind, Hospital[]> = {
          clinic: settled[0],
          hospital: settled[1],
          pharmacy: settled[2],
        };
        const total = settled[0].length + settled[1].length + settled[2].length;
        if (total === 0) {
          setByKind(splitFallbackByKind());
          setHasLoadedNearby(true);
        } else {
          setByKind(next);
          writeEmergencyByKindCache(cacheKey, next);
          setHasLoadedNearby(true);
        }
      } catch {
        if (!active) return;
        setByKind(splitFallbackByKind());
        setHasLoadedNearby(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void fetchNearby();
    return () => {
      active = false;
    };
  }, [locationFetchKey, hasLoadedNearby]);

  const kindCounts = useMemo(
    () => ({
      clinic: byKind.clinic.length,
      hospital: byKind.hospital.length,
      pharmacy: byKind.pharmacy.length,
    }),
    [byKind],
  );

  const rowsForTab = useMemo(() => {
    return byKind[facilityTab].map((h) => ({
      ...h,
      facilityKind: (h.facilityKind ?? inferFacilityKindFromName(h.name)) as FacilityKind,
      distance: h.distanceText ?? "Nearby",
    }));
  }, [byKind, facilityTab]);

  const displayHospitals = useMemo((): DisplayHospital[] => {
    const firstCoordIdx = rowsForTab.findIndex((x) => x.latitude != null && x.longitude != null);
    return rowsForTab.map((h, idx) => ({
      ...h,
      recommended: firstCoordIdx !== -1 && idx === firstCoordIdx,
    }));
  }, [rowsForTab]);

  const mapPins = useMemo((): EmergencyMapPin[] => {
    const firstCoordIdx = rowsForTab.findIndex((x) => x.latitude != null && x.longitude != null);
    const out: EmergencyMapPin[] = [];
    for (let idx = 0; idx < rowsForTab.length; idx++) {
      const h = rowsForTab[idx];
      if (h.latitude == null || h.longitude == null) continue;
      out.push({
        name: h.name,
        distanceText: h.distanceText,
        latitude: h.latitude,
        longitude: h.longitude,
        facilityKind: h.facilityKind,
        recommended: idx === firstCoordIdx,
      });
    }
    return out;
  }, [rowsForTab]);

  const mapAnchor = useMemo(() => {
    if (currentLocation) return currentLocation;
    for (const k of ["clinic", "hospital", "pharmacy"] as const) {
      const h = byKind[k].find((x) => x.latitude != null && x.longitude != null);
      if (h?.latitude != null && h?.longitude != null) {
        return { latitude: h.latitude, longitude: h.longitude };
      }
    }
    return null;
  }, [currentLocation, byKind]);

  return (
    <AppShell>
      <AppHeader title="Emergency help" showBack />

      <div className="space-y-5 px-4 pt-4">
        <Tabs
          value={facilityTab}
          onValueChange={(v) => setFacilityTab(v as FacilityKind)}
          className="w-full"
        >
          <TabsList className="grid h-auto w-full grid-cols-3 gap-0 rounded-none border-b border-border bg-transparent p-0">
            {(["clinic", "hospital", "pharmacy"] as const).map((kind) => (
              <TabsTrigger
                key={kind}
                value={kind}
                className="rounded-none border-b-2 border-transparent bg-transparent px-1 py-2.5 text-[11px] font-semibold leading-tight text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-3 sm:text-sm"
              >
                <span className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1.5">
                  <span>{KIND_LABEL[kind]}</span>
                  <span className="text-[10px] font-normal text-muted-foreground tabular-nums sm:text-xs">
                    ({kindCounts[kind]})
                  </span>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card className="relative h-44 overflow-hidden border-0 shadow-card">
          {mapAnchor ? (
            <InteractiveEmergencyMap
              key={facilityTab}
              currentLocation={mapAnchor}
              hospitals={mapPins}
            />
          ) : (
            <div className="flex h-full flex-col justify-between bg-muted/15 p-3">
              <Skeleton className="h-full min-h-[72px] w-full rounded-lg" />
            </div>
          )}
          {loading && mapAnchor ? (
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2 rounded-xl bg-card/90 px-3 py-2 text-xs shadow-soft backdrop-blur">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">Finding nearby…</span>
            </div>
          ) : null}
        </Card>
        {!loading && mapPins.length > 0 ? (
          <p className="flex items-center gap-2 px-0.5 text-[10px] text-muted-foreground">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span>
              Pulsing ring on the map = <span className="font-medium text-foreground">Recommended</span>{" "}
              ({KIND_LABEL[facilityTab].toLowerCase()})
            </span>
          </p>
        ) : null}
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

        <div className="grid grid-cols-2 gap-3">
          <Card className="flex items-center gap-3 p-3 shadow-soft">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Ambulance className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Ambulance</p>
              <a href="tel:999" className="block truncate text-sm font-semibold">
                999
              </a>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-3 shadow-soft">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Stethoscope className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Doctor hotline</p>
              <a href="tel:16263" className="block truncate text-sm font-semibold">
                16263
              </a>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="mb-2 font-display text-sm font-semibold">{SECTION_HEADING[facilityTab]}</h2>
          {loading ? (
            <HospitalListSkeleton />
          ) : displayHospitals.length === 0 ? (
            <Card className="p-4 text-center shadow-soft">
              <p className="text-sm text-muted-foreground">
                No {KIND_PLURAL_LOWER[facilityTab]} in this list yet. Try another tab above.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {displayHospitals.map((h, idx) => (
                <Card
                  key={`${h.mapsUrl}-${h.name}-${idx}`}
                  className="flex items-start gap-3 p-3 shadow-soft"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-pretty text-sm font-semibold leading-snug text-foreground/95">
                      {h.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{h.distance} away</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {h.recommended ? (
                      <span
                        className="inline-flex shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-semibold text-primary shadow-sm ring-1 ring-primary/25"
                        role="status"
                      >
                        Recommended
                      </span>
                    ) : null}
                    <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border/60 bg-muted/25 p-0.5 dark:bg-muted/15">
                      {hasCallablePhone(h.phone) ? (
                        <Button asChild size="icon" variant="ghost" className="h-9 w-9 shrink-0">
                          <a href={`tel:${h.phone}`} aria-label={`Call ${h.name}`}>
                            <Phone className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 shrink-0"
                          disabled
                          aria-label="No phone number listed"
                        >
                          <Phone className="h-4 w-4 opacity-40" />
                        </Button>
                      )}
                      <Button asChild size="icon" variant="ghost" className="h-9 w-9 shrink-0">
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
                  </div>
                </Card>
              ))}
            </div>
          )}
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
