"use client";

import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";

type HospitalPin = {
  name: string;
  distanceText: string | null;
  latitude: number | null;
  longitude: number | null;
};

const userIcon = L.divIcon({
  className: "leaflet-div-icon !bg-transparent !border-0",
  html: '<div style="width:14px;height:14px;border-radius:9999px;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,.25)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const hospitalIcon = L.divIcon({
  className: "leaflet-div-icon !bg-transparent !border-0",
  html: '<div style="width:12px;height:12px;border-radius:9999px;background:#dc2626;border:2px solid #fff;box-shadow:0 0 0 3px rgba(220,38,38,.2)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function FitBounds({
  currentLocation,
  hospitals,
}: {
  currentLocation: { latitude: number; longitude: number } | null;
  hospitals: HospitalPin[];
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

export default function InteractiveEmergencyMap({
  currentLocation,
  hospitals,
}: {
  currentLocation: { latitude: number; longitude: number } | null;
  hospitals: HospitalPin[];
}) {
  const center = currentLocation
    ? ([currentLocation.latitude, currentLocation.longitude] as [number, number])
    : ([23.8103, 90.4125] as [number, number]);

  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {currentLocation ? (
        <Marker
          position={[currentLocation.latitude, currentLocation.longitude]}
          icon={userIcon}
        >
          <Popup>You are here</Popup>
        </Marker>
      ) : null}

      {hospitals
        .filter((h) => h.latitude != null && h.longitude != null)
        .map((h) => (
          <Marker
            key={`${h.name}-${h.latitude}-${h.longitude}`}
            position={[h.latitude!, h.longitude!]}
            icon={hospitalIcon}
          >
            <Popup>
              <div className="min-w-[150px]">
                <p className="font-semibold">{h.name}</p>
                <p>{h.distanceText ?? "Nearby"}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      <FitBounds currentLocation={currentLocation} hospitals={hospitals} />
    </MapContainer>
  );
}

