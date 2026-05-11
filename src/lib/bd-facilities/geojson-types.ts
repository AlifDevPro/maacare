/**
 * GeoJSON Feature shape for BD health facility exports (OSM-derived).
 * `geometry.coordinates` is [longitude, latitude] per GeoJSON / RFC 7946.
 */
export type BdFacilityProperties = {
  id: string;
  name: string;
  name_en: string | null;
  name_bn: string | null;
  amenity: string | null;
  building: string | null;
  healthcare: string | null;
  healthcare_speciality: string | null;
  operator_type: string | null;
  capacity_persons: string | null;
  addr_full: string | null;
  addr_city: string | null;
  source: string | null;
  adm0_pcode: string | null;
  adm0_name: string | null;
  adm1_pcode: string | null;
  adm1_name: string | null;
  adm2_pcode: string | null;
  adm2_name: string | null;
  adm3_pcode: string | null;
  adm3_name: string | null;
  adm4_pcode: string | null;
  adm4_name: string | null;
  name_latin: string | null;
};

export type BdFacilityFeature = {
  type: "Feature";
  properties: BdFacilityProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
};

/** Map a GeoJSON feature row to Supabase `bd_health_facilities` columns. */
export function featureToFacilityRow(f: BdFacilityFeature) {
  const p = f.properties;
  const [longitude, latitude] = f.geometry.coordinates;
  return {
    osm_id: p.id,
    name: p.name?.trim() || "Unnamed facility",
    name_en: p.name_en,
    name_bn: p.name_bn,
    name_latin: p.name_latin,
    amenity: p.amenity,
    healthcare: p.healthcare,
    healthcare_speciality: p.healthcare_speciality,
    building: p.building,
    operator_type: p.operator_type,
    capacity_persons: p.capacity_persons,
    addr_full: p.addr_full,
    addr_city: p.addr_city,
    source: p.source,
    adm0_pcode: p.adm0_pcode,
    adm0_name: p.adm0_name,
    adm1_pcode: p.adm1_pcode,
    adm1_name: p.adm1_name,
    adm2_pcode: p.adm2_pcode,
    adm2_name: p.adm2_name,
    adm3_pcode: p.adm3_pcode,
    adm3_name: p.adm3_name,
    adm4_pcode: p.adm4_pcode,
    adm4_name: p.adm4_name,
    longitude,
    latitude,
    properties: p as unknown as Record<string, unknown>,
  };
}
