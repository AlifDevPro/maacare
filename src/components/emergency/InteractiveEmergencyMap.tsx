"use client";

import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";

import type { FacilityKind } from "@/lib/emergency/facility-kind";

export type EmergencyMapPin = {
  name: string;
  distanceText: string | null;
  latitude: number | null;
  longitude: number | null;
  facilityKind?: FacilityKind;
  /** First mappable pin in the current filtered list — highlighted with pulse on map. */
  recommended?: boolean;
};

const userIcon = L.divIcon({
  className: "leaflet-div-icon !bg-transparent !border-0",
  html: '<div style="width:14px;height:14px;border-radius:9999px;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,.25)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const KIND_STYLE: Record<
  FacilityKind,
  { bg: string; label: string; title: string }
> = {
  clinic: { bg: "#0891b2", label: "C", title: "Clinic / doctor chamber" },
  hospital: { bg: "#dc2626", label: "H", title: "Hospital" },
  pharmacy: { bg: "#7c3aed", label: "Rx", title: "Pharmacy" },
};

const iconCache = new Map<string, L.DivIcon>();

function makeFacilityIcon(kind: FacilityKind, recommended: boolean): L.DivIcon {
  const cacheKey = `${kind}-${recommended ? "1" : "0"}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const { bg, label, title } = KIND_STYLE[kind];
  const ring = recommended
    ? `<span class="maacare-map-pulse-ring" style="color:${bg};" aria-hidden="true"></span>`
    : "";
  const html = `<div class="maacare-em-pin" title="${title.replace(/"/g, "&quot;")}" style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
${ring}
<div style="position:relative;z-index:2;width:24px;height:24px;border-radius:9999px;background:${bg};color:#fff;font:700 10px/24px system-ui,-apple-system,sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.22);">${label}</div>
</div>`;
  const icon = L.divIcon({
    className: "leaflet-div-icon !bg-transparent !border-0",
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
  iconCache.set(cacheKey, icon);
  return icon;
}

function FitBounds({
  currentLocation,
  hospitals,
}: {
  currentLocation: { latitude: number; longitude: number } | null;
  hospitals: EmergencyMapPin[];
}) {
  const map = useMap();
  const points = useMemo(() => {
    const p: Array<[number, number]> = [];
    if (currentLocation) p.push([currentLocation.latitude, currentLocation.longitude]);
    hospitals.forEach((h) => {
      if (h.latitude != null && h.longitude != null) p.push([h.latitude, h.longitude]);
    });
    return p;
  }, [currentLocation, hospitals]);

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: true });
      return;
    }
    map.fitBounds(points, { padding: [28, 28], animate: true, maxZoom: 15 });
  }, [map, points]);

  return null;
}

/** Leaflet tile panes need correct container size after first layout (e.g. flex parents). */
function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    const run = () => map.invalidateSize({ animate: false });
    run();
    const t = window.setTimeout(run, 100);
    return () => window.clearTimeout(t);
  }, [map]);
  return null;
}

export default function InteractiveEmergencyMap({
  currentLocation,
  hospitals,
}: {
  currentLocation: { latitude: number; longitude: number } | null;
  hospitals: EmergencyMapPin[];
}) {
  /** Defer MapContainer until after paint so Leaflet panes exist. Do not use a “run once” ref — Strict Mode remount would cancel rAF and never reschedule. */
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = window.requestAnimationFrame(() => {
      if (!cancelled) setMapReady(true);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(id);
    };
  }, []);

  const center = currentLocation
    ? ([currentLocation.latitude, currentLocation.longitude] as [number, number])
    : ([23.8103, 90.4125] as [number, number]);

  const pins = hospitals.filter((h) => h.latitude != null && h.longitude != null);

  if (!mapReady) {
    return <div className="h-full w-full bg-muted/30" aria-busy="true" aria-label="Loading map" />;
  }

  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <InvalidateSizeOnMount />

      {currentLocation ? (
        <Marker
          position={[currentLocation.latitude, currentLocation.longitude]}
          icon={userIcon}
        >
          <Popup>You are here</Popup>
        </Marker>
      ) : null}

      {pins.map((h) => {
        const kind: FacilityKind = h.facilityKind ?? "hospital";
        const icon = makeFacilityIcon(kind, Boolean(h.recommended));
        return (
          <Marker
            key={`${h.name}-${h.latitude}-${h.longitude}-${kind}-${h.recommended ? "top" : ""}`}
            position={[h.latitude!, h.longitude!]}
            icon={icon}
          >
            <Popup>
              <div className="min-w-[150px]">
                <p className="font-semibold">{h.name}</p>
                <p className="text-xs text-muted-foreground">{h.distanceText ?? "Nearby"}</p>
                <p className="mt-1 text-[11px] font-medium text-foreground/80">{KIND_STYLE[kind].title}</p>
                {h.recommended ? (
                  <p className="mt-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Recommended for directions
                  </p>
                ) : null}
              </div>
            </Popup>
          </Marker>
        );
      })}
      <FitBounds currentLocation={currentLocation} hospitals={pins} />
    </MapContainer>
  );
}
