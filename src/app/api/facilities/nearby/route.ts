import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import {
  DEFAULT_PHARMACY_TAGS,
  fetchNearbyEmergencyListPrioritized,
  fetchNearbyFacilitiesFromDb,
} from "@/lib/bd-facilities/nearby";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  /** OSM amenity / healthcare values, e.g. ["pharmacy"] or ["hospital","clinic"]. */
  kinds: z.array(z.string().min(1)).max(20).optional(),
  /** Preset when `kinds` omitted: "emergency" | "pharmacy" | "all" (no tag filter). */
  preset: z.enum(["emergency", "pharmacy", "all"]).optional().default("emergency"),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return failJson(400, "Invalid request body.");

    const { latitude, longitude, kinds, preset, limit } = parsed.data;

    const supabase = await createSupabaseServerClient();

    type FacilityDto = {
      name: string;
      mapsUrl: string;
      phone: string | null;
      address: string | null;
      distanceText: string | null;
      latitude: number | null;
      longitude: number | null;
    };

    const mapHit = (h: {
      name: string;
      mapsUrl: string;
      phone: string | null;
      address: string | null;
      distanceText: string | null;
      latitude: number | null;
      longitude: number | null;
    }): FacilityDto => ({
      name: h.name,
      mapsUrl: h.mapsUrl,
      phone: h.phone,
      address: h.address,
      distanceText: h.distanceText,
      latitude: h.latitude,
      longitude: h.longitude,
    });

    let facilities: FacilityDto[];
    if (kinds?.length) {
      const tags = kinds.map((k) => k.toLowerCase().trim()).filter(Boolean);
      const rows = await fetchNearbyFacilitiesFromDb(supabase, { latitude, longitude, tags, limit });
      facilities = rows.map(mapHit);
    } else if (preset === "pharmacy") {
      const rows = await fetchNearbyFacilitiesFromDb(supabase, {
        latitude,
        longitude,
        tags: [...DEFAULT_PHARMACY_TAGS],
        limit,
      });
      facilities = rows.map(mapHit);
    } else if (preset === "all") {
      const rows = await fetchNearbyFacilitiesFromDb(supabase, {
        latitude,
        longitude,
        tags: [],
        limit,
      });
      facilities = rows.map(mapHit);
    } else {
      const rows = await fetchNearbyEmergencyListPrioritized(supabase, {
        latitude,
        longitude,
        maxTotal: limit,
        clinicLimit: Math.min(12, limit),
        hospitalLimit: Math.min(12, limit),
        pharmacyLimit: Math.min(8, limit),
        includePharmacy: true,
      });
      facilities = rows.map(mapHit);
    }

    return Response.json({
      facilities,
      empty: facilities.length === 0,
    });
  } catch (e) {
    return serverErrorJson("facilities/nearby POST", e);
  }
}
