import type { SupabaseClient } from "@supabase/supabase-js";

/** Default OSM-style tags for emergency care (legacy single-query filter). */
export const DEFAULT_EMERGENCY_TAGS = ["hospital", "clinic", "doctors"] as const;

export const CLINIC_TAGS = ["clinic", "doctors"] as const;
export const HOSPITAL_TAGS = ["hospital"] as const;

/** Common tags for pharmacy lookup. */
export const DEFAULT_PHARMACY_TAGS = ["pharmacy"] as const;

export type NearbyFacilityRow = {
  osm_id: string;
  name: string;
  amenity: string | null;
  healthcare: string | null;
  addr_full: string | null;
  addr_city: string | null;
  adm2_name: string | null;
  adm3_name: string | null;
  adm4_name: string | null;
  latitude: number;
  longitude: number;
  distance_km: number;
};

export type NearbyHospitalHit = {
  name: string;
  mapsUrl: string;
  phone: string | null;
  address: string | null;
  distanceText: string | null;
  latitude: number | null;
  longitude: number | null;
  source: "dataset";
  osmId?: string;
};

export type FacilityTier = "clinic" | "hospital" | "pharmacy";

export type NearbyHospitalHitWithTier = NearbyHospitalHit & { tier: FacilityTier };

function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "Nearby";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

function buildAddress(row: NearbyFacilityRow): string | null {
  const parts = [
    row.addr_full,
    row.addr_city,
    [row.adm4_name, row.adm3_name, row.adm2_name].filter(Boolean).join(", "),
  ].filter((p) => p && String(p).trim());
  const s = parts.join(" · ").trim();
  return s || null;
}

export function facilityRowToHospitalHit(row: NearbyFacilityRow): NearbyHospitalHit {
  const q = `${row.latitude},${row.longitude}`;
  return {
    name: row.name,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
    phone: null,
    address: buildAddress(row),
    distanceText: formatDistanceKm(row.distance_km),
    latitude: row.latitude,
    longitude: row.longitude,
    source: "dataset",
    osmId: row.osm_id,
  };
}

export async function fetchNearbyFacilityRowsFromDb(
  supabase: SupabaseClient,
  params: {
    latitude: number;
    longitude: number;
    tags: string[];
    limit?: number;
  },
): Promise<NearbyFacilityRow[]> {
  const limit = Math.min(50, Math.max(1, params.limit ?? 20));
  const { data, error } = await supabase.rpc("nearby_bd_health_facilities", {
    p_lat: params.latitude,
    p_lng: params.longitude,
    p_tags: params.tags.length ? params.tags : null,
    p_limit: limit,
  });

  if (error) {
    console.error("[bd-facilities] nearby rpc error", error.message);
    return [];
  }

  return (data ?? []) as NearbyFacilityRow[];
}

export async function fetchNearbyFacilitiesFromDb(
  supabase: SupabaseClient,
  params: {
    latitude: number;
    longitude: number;
    tags: string[];
    limit?: number;
  },
): Promise<NearbyHospitalHit[]> {
  const rows = await fetchNearbyFacilityRowsFromDb(supabase, params);
  return rows.map(facilityRowToHospitalHit);
}

/**
 * Clinics/doctors first, then hospitals, then pharmacies — each bucket nearest-first; deduped by osm_id.
 */
export async function fetchNearbyEmergencyListPrioritized(
  supabase: SupabaseClient,
  params: {
    latitude: number;
    longitude: number;
    clinicLimit?: number;
    hospitalLimit?: number;
    pharmacyLimit?: number;
    maxTotal?: number;
    /** When false, only clinics then hospitals (e.g. chat “hospital” intent without pharmacy). Default true. */
    includePharmacy?: boolean;
  },
): Promise<NearbyHospitalHitWithTier[]> {
  const clinicLimit = params.clinicLimit ?? 8;
  const hospitalLimit = params.hospitalLimit ?? 8;
  const pharmacyLimit = params.pharmacyLimit ?? 4;
  const maxTotal = params.maxTotal ?? 16;
  const includePharmacy = params.includePharmacy !== false;

  const seen = new Set<string>();
  const out: NearbyHospitalHitWithTier[] = [];

  const pushTier = (rows: NearbyFacilityRow[], tier: FacilityTier) => {
    for (const row of rows) {
      if (out.length >= maxTotal) return;
      if (!row.osm_id || seen.has(row.osm_id)) continue;
      seen.add(row.osm_id);
      out.push({ ...facilityRowToHospitalHit(row), tier });
    }
  };

  const [clinics, hospitals, pharmacies] = await Promise.all([
    fetchNearbyFacilityRowsFromDb(supabase, {
      latitude: params.latitude,
      longitude: params.longitude,
      tags: [...CLINIC_TAGS],
      limit: clinicLimit,
    }),
    fetchNearbyFacilityRowsFromDb(supabase, {
      latitude: params.latitude,
      longitude: params.longitude,
      tags: [...HOSPITAL_TAGS],
      limit: hospitalLimit,
    }),
    includePharmacy
      ? fetchNearbyFacilityRowsFromDb(supabase, {
          latitude: params.latitude,
          longitude: params.longitude,
          tags: [...DEFAULT_PHARMACY_TAGS],
          limit: pharmacyLimit,
        })
      : Promise.resolve([]),
  ]);
  pushTier(clinics, "clinic");
  pushTier(hospitals, "hospital");
  if (includePharmacy) pushTier(pharmacies, "pharmacy");

  return out.slice(0, maxTotal);
}

/** One category only — nearest first, max `limit` (capped at 8 for emergency list). */
export async function fetchNearbyEmergencyByCategory(
  supabase: SupabaseClient,
  params: {
    latitude: number;
    longitude: number;
    category: FacilityTier;
    limit?: number;
  },
): Promise<NearbyHospitalHitWithTier[]> {
  const limit = Math.min(8, Math.max(1, params.limit ?? 8));
  const tags =
    params.category === "clinic"
      ? [...CLINIC_TAGS]
      : params.category === "hospital"
        ? [...HOSPITAL_TAGS]
        : [...DEFAULT_PHARMACY_TAGS];
  const rows = await fetchNearbyFacilityRowsFromDb(supabase, {
    latitude: params.latitude,
    longitude: params.longitude,
    tags,
    limit,
  });
  return rows.map((row) => ({ ...facilityRowToHospitalHit(row), tier: params.category }));
}
