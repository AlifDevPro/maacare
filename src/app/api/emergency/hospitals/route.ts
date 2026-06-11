import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { fetchNearbyEmergencyByCategory } from "@/lib/bd-facilities/nearby";
import type { FacilityKind } from "@/lib/emergency/facility-kind";
import { enforceSubscriptionFeature } from "@/lib/subscription/enforce";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const categorySchema = z.enum(["clinic", "hospital", "pharmacy"]);

const bodySchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  /** One request = one category, max 8 rows in the response. */
  category: categorySchema,
});

type HospitalHit = {
  name: string;
  mapsUrl: string;
  phone: string | null;
  address: string | null;
  distanceText: string | null;
  latitude: number | null;
  longitude: number | null;
  facilityKind?: FacilityKind;
};
const CACHE_TTL_MS = 10 * 60 * 1000;
const memoryCache = new Map<string, { savedAt: number; hospitals: HospitalHit[] }>();

function geoBucketKey(latitude: number, longitude: number): string {
  // ~110m bucket keeps nearby lookups stable and cache-friendly.
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

function cacheKey(input: { latitude: number; longitude: number; category: FacilityKind }): string {
  return `${input.category}:${geoBucketKey(input.latitude, input.longitude)}`;
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to use emergency map.");

    const facilitiesGate = await enforceSubscriptionFeature(session.id, "nearby_facilities");
    if (!facilitiesGate.ok) return facilitiesGate.response;

    const payload = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!payload.success) return failJson(400, "Invalid location or category.");

    const { latitude, longitude, category } = payload.data;
    const k = cacheKey({ latitude, longitude, category });
    const now = Date.now();

    const cached = memoryCache.get(k);
    if (cached && now - cached.savedAt < CACHE_TTL_MS) {
      return Response.json(
        { hospitals: cached.hospitals, source: "dataset-cache" as const, category },
        { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
      );
    }

    async function loadFromDataset(): Promise<HospitalHit[]> {
      try {
        const supabase = await createSupabaseServerClient();
        const hits = await fetchNearbyEmergencyByCategory(supabase, {
          latitude,
          longitude,
          category,
          limit: 8,
        });
        return hits.map(({ name, mapsUrl, phone, address, distanceText, latitude: lat, longitude: lng, tier }) => ({
          name,
          mapsUrl,
          phone,
          address,
          distanceText,
          latitude: lat,
          longitude: lng,
          facilityKind: tier as FacilityKind,
        }));
      } catch (e) {
        console.error("[emergency/hospitals] dataset load failed", e);
        return [];
      }
    }

    const fromDataset = await loadFromDataset();
    if (fromDataset.length > 0) {
      const hospitals = fromDataset.slice(0, 8);
      memoryCache.set(k, { savedAt: now, hospitals });
      return Response.json(
        { hospitals, source: "dataset" as const, category },
        { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
      );
    }

    return failJson(502, "Could not fetch nearby places from local facility data.");
  } catch (e) {
    return serverErrorJson("emergency/hospitals POST", e);
  }
}
