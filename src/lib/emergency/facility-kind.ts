export type FacilityKind = "clinic" | "hospital" | "pharmacy";

/** Guess OSM-style category from English/Bangla name when AI or fallback rows have no tier. */
export function inferFacilityKindFromName(name: string): FacilityKind {
  const n = name.toLowerCase();
  if (/\b(pharmacy|chemist|drug\s*store|medicine shop|ঔষধ)\b/i.test(n) || /ফার্মেসি/.test(name)) {
    return "pharmacy";
  }
  if (
    /\b(clinic|chamber|diagnostic|polyclinic|doctor'?s?\s+chamber)\b/i.test(n) ||
    /ক্লিনিক|চেম্বার|ডাক্তার/.test(name)
  ) {
    return "clinic";
  }
  return "hospital";
}
