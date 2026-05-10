import { addDays, differenceInCalendarWeeks, format, parseISO } from "date-fns";

/** Completed pregnancy weeks from LMP (0–42 clamp). */
export function gestationalWeekFromLmp(lmpIso: string | null | undefined): number | null {
  if (!lmpIso) return null;
  const start = parseISO(lmpIso);
  if (Number.isNaN(start.getTime())) return null;
  const weeks = differenceInCalendarWeeks(new Date(), start);
  return Math.min(42, Math.max(0, weeks));
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
