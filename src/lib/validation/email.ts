import { z } from "zod";

const emailSchema = z.string().email();

/** True when the string is a non-empty, syntactically valid email (RFC-style via Zod). */
export function isValidEmailFormat(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  return emailSchema.safeParse(t).success;
}
