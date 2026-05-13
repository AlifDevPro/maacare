import { addDays, differenceInCalendarWeeks, format, parseISO } from "date-fns";

/** Coerce DB/API week values (PostgREST may return int as string). */
export function coerceGestationalWeek(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    const n = Number.parseInt(t, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** Completed pregnancy weeks from LMP (0–42 clamp). */
export function gestationalWeekFromLmp(lmpIso: string | null | undefined): number | null {
  if (!lmpIso) return null;
  const start = parseISO(lmpIso);
  if (Number.isNaN(start.getTime())) return null;
  const weeks = differenceInCalendarWeeks(new Date(), start);
  return Math.min(42, Math.max(0, weeks));
}

/** Approximate completed weeks from EDD alone (Naegele: LMP = EDD − 280 days). */
export function gestationalWeekFromEdd(eddIso: string | null | undefined): number | null {
  if (!eddIso) return null;
  const due = parseISO(eddIso.slice(0, 10));
  if (Number.isNaN(due.getTime())) return null;
  const lmp = addDays(due, -280);
  const weeks = differenceInCalendarWeeks(new Date(), lmp);
  return Math.min(42, Math.max(0, weeks));
}

type PregnancyWeekSource = {
  gestational_age_weeks?: unknown;
  lmp_date?: string | null;
  edd_date?: string | null;
} | null;

/** Single source of truth for “current week” used on home + profile. */
export function resolveGestationalWeek(pregnancy: PregnancyWeekSource): number | null {
  if (!pregnancy) return null;
  const stored = coerceGestationalWeek(pregnancy.gestational_age_weeks);
  const storedMeaningful = stored != null && stored >= 1;
  if (storedMeaningful) return Math.min(45, Math.max(0, stored));
  const fromLmp = gestationalWeekFromLmp(pregnancy.lmp_date ?? undefined);
  if (fromLmp != null) return fromLmp;
  return gestationalWeekFromEdd(pregnancy.edd_date ?? undefined);
}

/** Naegele-style EDD from LMP (LMP + 280 days). */
export function estimatedDueDateFromLmp(lmpIso: string): string | null {
  const start = parseISO(lmpIso);
  if (Number.isNaN(start.getTime())) return null;
  return format(addDays(start, 280), "yyyy-MM-dd");
}

export function formatIsoDate(iso: string | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return "—";
  }
}
