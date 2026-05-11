import type { FacilityKind } from "@/lib/emergency/facility-kind";

/** Minimal hospital row shape stored in cache (matches API list items). */
export type EmergencyHospitalCacheRow = {
  name: string;
  phone: string | null;
  distanceText: string | null;
  address: string | null;
  mapsUrl: string;
  latitude: number | null;
  longitude: number | null;
  facilityKind?: FacilityKind;
};

export type EmergencyByKindCache = Record<FacilityKind, EmergencyHospitalCacheRow[]>;

const STORAGE_PREFIX = "maacare_emergency_bykind_v1:";
const TTL_MS = 10 * 60 * 1000;

const memory = new Map<string, { savedAt: number; data: EmergencyByKindCache }>();

export function emergencyGeoBucketKey(lat: number, lng: number, decimals = 4): string {
  return `${lat.toFixed(decimals)},${lng.toFixed(decimals)}`;
}

export function readEmergencyByKindCache(key: string): EmergencyByKindCache | null {
  const m = memory.get(key);
  if (m) {
    if (Date.now() - m.savedAt < TTL_MS) return m.data;
    memory.delete(key);
  }
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; data: EmergencyByKindCache };
    if (Date.now() - parsed.savedAt > TTL_MS) {
      sessionStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    memory.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeEmergencyByKindCache(key: string, data: EmergencyByKindCache): void {
  const payload = { savedAt: Date.now(), data };
  memory.set(key, payload);
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(payload));
  } catch {
    /* quota or private mode */
  }
}
