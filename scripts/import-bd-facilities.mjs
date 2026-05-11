/**
 * Bulk-import GeoJSON Features into public.bd_health_facilities.
 *
 * FULL SETUP (once per project):
 *   1. In Supabase SQL editor (or `supabase db push`), apply migrations:
 *        - 20250524000000_bd_health_facilities.sql  (table + RLS read for signed-in users)
 *        - 20250524100000_nearby_bd_health_facilities_rpc.sql  (nearest search function)
 *   2. Ensure .env has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role never in client code).
 *   3. Export your ~8k OSM features as JSON (FeatureCollection, or array of Features, or comma-separated Features).
 *   4. Run from repo root:
 *        npm run import-bd-facilities -- ./your-export.json
 *   5. Emergency tab: tries Gemini + Google Maps first; if that returns nothing or errors, uses this table.
 *      Chat: user taps "Share location", asks "nearest hospital/pharmacy" — same table is injected into the prompt.
 *
 * Usage:
 *   node scripts/import-bd-facilities.mjs path/to/features.json
 *
 * Env (from shell or .env in project root):
 *   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Supports:
 *   - FeatureCollection JSON
 *   - single Feature JSON
 *   - JSON array of Features
 *   - loose comma-separated Feature objects (wrapped as array)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile() {
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return;
  const s = readFileSync(p, "utf8");
  for (const line of s.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function parseFeatures(text) {
  const t = text.trim();
  if (!t) return [];
  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let j = tryParse(t);
  if (j?.type === "FeatureCollection" && Array.isArray(j.features)) {
    return j.features.filter((f) => f?.type === "Feature" && f.geometry?.type === "Point");
  }
  if (j?.type === "Feature" && j.geometry?.type === "Point") return [j];
  if (Array.isArray(j)) return j.filter((f) => f?.type === "Feature" && f.geometry?.type === "Point");
  const wrapped = tryParse(`[${t.replace(/,\s*$/u, "")}]`);
  if (Array.isArray(wrapped)) {
    return wrapped.filter((f) => f?.type === "Feature" && f.geometry?.type === "Point");
  }
  return [];
}

function featureToRow(f) {
  const p = f.properties ?? {};
  const coords = f.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) throw new Error("Invalid Point coordinates");
  const [longitude, latitude] = coords;
  return {
    osm_id: String(p.id ?? ""),
    name: String(p.name ?? "").trim() || "Unnamed facility",
    name_en: p.name_en ?? null,
    name_bn: p.name_bn ?? null,
    name_latin: p.name_latin ?? null,
    amenity: p.amenity ?? null,
    healthcare: p.healthcare ?? null,
    healthcare_speciality: p.healthcare_speciality ?? null,
    building: p.building ?? null,
    operator_type: p.operator_type ?? null,
    capacity_persons: p.capacity_persons != null ? String(p.capacity_persons) : null,
    addr_full: p.addr_full ?? null,
    addr_city: p.addr_city ?? null,
    source: p.source ?? null,
    adm0_pcode: p.adm0_pcode ?? null,
    adm0_name: p.adm0_name ?? null,
    adm1_pcode: p.adm1_pcode ?? null,
    adm1_name: p.adm1_name ?? null,
    adm2_pcode: p.adm2_pcode ?? null,
    adm2_name: p.adm2_name ?? null,
    adm3_pcode: p.adm3_pcode ?? null,
    adm3_name: p.adm3_name ?? null,
    adm4_pcode: p.adm4_pcode ?? null,
    adm4_name: p.adm4_name ?? null,
    longitude: Number(longitude),
    latitude: Number(latitude),
    properties: p,
  };
}

async function main() {
  loadEnvFile();
  const filePath = resolve(process.cwd(), process.argv[2] ?? "");
  if (!filePath || !existsSync(filePath)) {
    console.error("Usage: node scripts/import-bd-facilities.mjs <path-to-json>");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const raw = readFileSync(filePath, "utf8");
  const features = parseFeatures(raw);
  if (!features.length) {
    console.error("No GeoJSON Point features found in file.");
    process.exit(1);
  }

  const rows = [];
  for (const f of features) {
    try {
      const r = featureToRow(f);
      if (!r.osm_id) {
        console.warn("Skip feature without properties.id");
        continue;
      }
      rows.push(r);
    } catch (e) {
      console.warn("Skip invalid feature:", e.message);
    }
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const batchSize = 400;
  let ok = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from("bd_health_facilities").upsert(batch, { onConflict: "osm_id" });
    if (error) {
      console.error("Upsert failed at offset", i, error.message);
      process.exit(1);
    }
    ok += batch.length;
    console.log(`Upserted ${ok} / ${rows.length}`);
  }
  console.log("Done.", rows.length, "rows.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
