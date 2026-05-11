import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_PHARMACY_TAGS,
  fetchNearbyEmergencyListPrioritized,
  fetchNearbyFacilityRowsFromDb,
  facilityRowToHospitalHit,
  type FacilityTier,
  type NearbyHospitalHitWithTier,
} from "@/lib/bd-facilities/nearby";

export type NearbyFacilitiesIntent = "hospital" | "pharmacy" | "both" | null;

/** Detect if the user is asking for nearby physical facilities (EN/BN keywords). */
export function detectNearbyFacilitiesIntent(text: string): NearbyFacilitiesIntent {
  const t = text.toLowerCase();
  const bnHospital = /হাসপাতাল/.test(text);
  const bnPharmacy = /ফার্মেসি/.test(text);

  const pharmacy =
    bnPharmacy ||
    /\b(pharmacy|chemist|medicine shop|drug\s*store|drugstore|prescription)\b/i.test(t);
  const hospital =
    bnHospital ||
    /\b(hospital|clinics?|emergency room|emergency department|\ber\b|nearest hospital|nearby hospital)\b/i.test(
      t,
    );

  if (pharmacy && hospital) return "both";
  if (pharmacy) return "pharmacy";
  if (hospital) return "hospital";
  if (/\bnear(est)?\b.*\b(facilit|medical care|health care)\b/i.test(t)) return "both";
  return null;
}

function formatHitLines(items: NearbyHospitalHitWithTier[], startIdx: number): string[] {
  return items.map(
    (h, i) =>
      `${startIdx + i}. ${h.name} — ${h.distanceText ?? "distance unknown"}${h.address ? ` — ${h.address}` : ""}`,
  );
}

/** Flat catalog for one-tap AI: clinics → hospitals → pharmacies. */
export async function buildOneShotNearbyCatalogBlock(
  supabase: SupabaseClient,
  latitude: number,
  longitude: number,
): Promise<string> {
  const hits = await fetchNearbyEmergencyListPrioritized(supabase, {
    latitude,
    longitude,
    maxTotal: 28,
    clinicLimit: 10,
    hospitalLimit: 10,
    pharmacyLimit: 6,
    includePharmacy: true,
  });

  const section = (title: string, tier: FacilityTier) => {
    const items = hits.filter((h) => h.tier === tier);
    const body =
      items.length > 0
        ? formatHitLines(items, 1).join("\n")
        : "(No rows in this category for this area.)";
    return `${title}\n${body}`;
  };

  return [
    section("CLINICS / DOCTOR CHAMBERS (nearest first):", "clinic"),
    "",
    section("HOSPITALS (nearest first):", "hospital"),
    "",
    section("PHARMACIES — nearby if useful (nearest first):", "pharmacy"),
  ].join("\n");
}

/** Text block appended to chat system prompt — prioritized tiers. */
export async function buildNearbyFacilitiesContextForChat(
  supabase: SupabaseClient,
  params: { latitude: number; longitude: number; intent: Exclude<NearbyFacilitiesIntent, null> },
): Promise<string> {
  const lines: string[] = [
    "NEARBY FACILITIES (user shared GPS; Bangladesh catalog — order: clinics first, then hospitals, then pharmacies when relevant):",
  ];

  if (params.intent === "pharmacy") {
    const rows = await fetchNearbyFacilityRowsFromDb(supabase, {
      latitude: params.latitude,
      longitude: params.longitude,
      tags: [...DEFAULT_PHARMACY_TAGS],
      limit: 12,
    });
    lines.push("", "Pharmacies (nearest first):");
    if (!rows.length) lines.push("(No matching rows in catalog for this area.)");
    else {
      rows.forEach((r, i) => {
        const h = facilityRowToHospitalHit(r);
        lines.push(
          `${i + 1}. ${h.name} — ${h.distanceText ?? "distance unknown"}${h.address ? ` — ${h.address}` : ""}`,
        );
      });
    }
    lines.push(
      "",
      "Recommend from this list by name and distance. Do not invent phone numbers.",
    );
    return lines.join("\n");
  }

  const includePharmacy = params.intent === "both";
  const hits = await fetchNearbyEmergencyListPrioritized(supabase, {
    latitude: params.latitude,
    longitude: params.longitude,
    maxTotal: includePharmacy ? 20 : 14,
    clinicLimit: 8,
    hospitalLimit: 8,
    pharmacyLimit: 4,
    includePharmacy,
  });

  const clinics = hits.filter((h) => h.tier === "clinic");
  const hospitals = hits.filter((h) => h.tier === "hospital");
  const pharmacies = hits.filter((h) => h.tier === "pharmacy");

  lines.push("", "Clinics / doctor chambers (nearest first):");
  lines.push(
    clinics.length ? formatHitLines(clinics, 1).join("\n") : "(No matching rows in catalog for this area.)",
  );

  lines.push("", "Hospitals (nearest first):");
  lines.push(
    hospitals.length ? formatHitLines(hospitals, 1).join("\n") : "(No matching rows in catalog for this area.)",
  );

  if (includePharmacy) {
    lines.push("", "Pharmacies (nearest first):");
    lines.push(
      pharmacies.length
        ? formatHitLines(pharmacies, 1).join("\n")
        : "(No matching rows in catalog for this area.)",
    );
  }

  lines.push(
    "",
    "Use this list to recommend specific places by name and distance. If a section is empty, say so. Suggest Emergency tab or clinician when appropriate. Do not invent phone numbers.",
  );

  return lines.join("\n");
}
