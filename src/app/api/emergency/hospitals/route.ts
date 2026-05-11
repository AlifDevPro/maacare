import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { fetchNearbyEmergencyByCategory } from "@/lib/bd-facilities/nearby";
import type { FacilityKind } from "@/lib/emergency/facility-kind";
import { getGeminiApiKeys } from "@/lib/gemini/keys";
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

function extractFirstJsonArray(text: string): unknown[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseLatLngFromMapsUrl(url: string): { latitude: number; longitude: number } | null {
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) {
    return { latitude: Number(at[1]), longitude: Number(at[2]) };
  }
  const q = url.match(/[?&](?:query|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) {
    return { latitude: Number(q[1]), longitude: Number(q[2]) };
  }
  return null;
}

async function geocodeWithOsm(
  name: string,
  latitude: number,
  longitude: number,
): Promise<{ latitude: number; longitude: number } | null> {
  const latPad = 0.2;
  const lonPad = 0.2;
  const viewbox = `${longitude - lonPad},${latitude + latPad},${longitude + lonPad},${latitude - latPad}`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    name,
  )}&limit=1&bounded=1&viewbox=${encodeURIComponent(viewbox)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MaaCarePlatform/1.0 (Emergency hospital lookup)",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json().catch(() => [])) as Array<{ lat?: string; lon?: string }>;
    const first = rows[0];
    if (!first?.lat || !first?.lon) return null;
    return { latitude: Number(first.lat), longitude: Number(first.lon) };
  } catch {
    return null;
  }
}

function geminiPromptForCategory(category: FacilityKind): string {
  const label =
    category === "clinic"
      ? "clinics and doctor chambers (general practice / outpatient)"
      : category === "hospital"
        ? "hospitals with emergency and maternity or OB/GYN when relevant"
        : "pharmacies and drug stores";
  return [
    `Find the nearest ${label} around this map location.`,
    "Return STRICT JSON array only with max 8 items.",
    `Each item must be: {"name":"...","phone":"...","address":"...","distanceText":"..."}`,
    "If a value is unknown, use null.",
    `Only include real ${category === "pharmacy" ? "pharmacies" : category === "clinic" ? "clinics or chambers" : "hospitals"} — do not mix other facility types.`,
  ].join("\n");
}

function defaultNameForRow(category: FacilityKind, idx: number): string {
  if (category === "clinic") return `Nearby clinic ${idx + 1}`;
  if (category === "pharmacy") return `Nearby pharmacy ${idx + 1}`;
  return `Nearby hospital ${idx + 1}`;
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to use emergency map.");

    const payload = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!payload.success) return failJson(400, "Invalid location or category.");

    const keys = getGeminiApiKeys();
    const { latitude, longitude, category } = payload.data;

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

    const model = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";
    const prompt = geminiPromptForCategory(category);

    let lastErr: unknown = null;
    if (keys.length > 0) {
      for (const key of keys) {
        try {
          const ai = new GoogleGenAI({ apiKey: key });
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              tools: [{ googleMaps: {} }],
              toolConfig: {
                retrievalConfig: {
                  latLng: { latitude, longitude },
                },
              },
            },
          });

          const rows = extractFirstJsonArray(response.text ?? "") ?? [];
          const chunks =
            response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
          const mapUris: string[] = chunks
            .map((c: unknown) => {
              const maps = (c as { maps?: { uri?: string } }).maps;
              return maps?.uri ?? "";
            })
            .filter(Boolean);

          const hospitalsRaw: HospitalHit[] = rows
            .slice(0, 8)
            .map((row, idx) => {
              const item = row as Record<string, unknown>;
              const q =
                typeof item.name === "string" && item.name.trim()
                  ? item.name.trim()
                  : defaultNameForRow(category, idx);
              const mapsUrl =
                mapUris[idx] ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
              const parsedLatLng = parseLatLngFromMapsUrl(mapsUrl);
              return {
                name: q,
                phone:
                  typeof item.phone === "string" && item.phone.trim()
                    ? item.phone.trim()
                    : null,
                address:
                  typeof item.address === "string" && item.address.trim()
                    ? item.address.trim()
                    : null,
                distanceText:
                  typeof item.distanceText === "string" && item.distanceText.trim()
                    ? item.distanceText.trim()
                    : null,
                mapsUrl,
                latitude: parsedLatLng?.latitude ?? null,
                longitude: parsedLatLng?.longitude ?? null,
                facilityKind: category,
              };
            })
            .filter((h) => Boolean(h.name));
          const hospitals: HospitalHit[] = await Promise.all(
            hospitalsRaw.map(async (h) => {
              if (h.latitude != null && h.longitude != null) return h;
              const geocoded = await geocodeWithOsm(h.name, latitude, longitude);
              return {
                ...h,
                latitude: geocoded?.latitude ?? null,
                longitude: geocoded?.longitude ?? null,
                facilityKind: category,
              };
            }),
          );
          if (hospitals.length > 0) {
            return Response.json({ hospitals, source: "gemini" as const, category });
          }
        } catch (e) {
          lastErr = e;
        }
      }
      console.error("[emergency/hospitals] all Gemini keys failed or returned empty", lastErr);
    }

    const fromDataset = await loadFromDataset();
    if (fromDataset.length > 0) {
      return Response.json({ hospitals: fromDataset.slice(0, 8), source: "dataset" as const, category });
    }

    return failJson(
      502,
      keys.length === 0
        ? "Gemini is not configured and no local facility rows were found. Import BD facilities and apply migrations."
        : "Could not fetch nearby places from AI or local data.",
    );
  } catch (e) {
    return serverErrorJson("emergency/hospitals POST", e);
  }
}
