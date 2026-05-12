import { escapeIlike } from "@/lib/community/aggregate-counts";
import { htmlToPlainText } from "@/lib/community/html-to-plain-text";

const MAX_TOKENS = 6;
const TYPO_NEIGHBOR_CAP = 10;
const MAX_FILTER_TOKENS = 22;

/** Single-step typo / edit neighbors for fuzzy ilike OR (bounded). */
function typoNeighborsOneStep(raw: string): string[] {
  const lower = raw.toLowerCase();
  const out = new Set<string>();
  const letters = "abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i < lower.length && out.size < TYPO_NEIGHBOR_CAP; i++) {
    const del = lower.slice(0, i) + lower.slice(i + 1);
    if (del.length >= 2) out.add(del);
    for (const c of letters) {
      if (out.size >= TYPO_NEIGHBOR_CAP) break;
      out.add(lower.slice(0, i) + c + lower.slice(i + 1));
    }
  }
  for (let i = 0; i < lower.length - 1 && out.size < TYPO_NEIGHBOR_CAP; i++) {
    out.add(lower.slice(0, i) + lower[i + 1] + lower[i] + lower.slice(i + 2));
  }
  return [...out];
}

/**
 * Tokens used in PostgREST `or(...)` for search — includes one-step typo variants
 * for tokens with length ≥ 4 so single-token typos still match rows.
 */
export function communitySearchTokensWithTypoExpansion(q: string): string[] {
  const base = communitySearchTokens(q);
  const expanded = new Set<string>();
  for (const t of base) {
    expanded.add(t);
    if (t.length >= 4) {
      for (const n of typoNeighborsOneStep(t)) {
        if (n !== t.toLowerCase()) expanded.add(n);
      }
    }
  }
  const whole = q.trim();
  if (whole.length >= 5 && !whole.includes(" ") && base.length <= 1) {
    expanded.add(whole);
    for (const n of typoNeighborsOneStep(whole)) {
      if (n !== whole.toLowerCase()) expanded.add(n);
    }
  }
  return [...expanded].slice(0, MAX_FILTER_TOKENS);
}

export function communitySearchTokens(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, MAX_TOKENS);
}

/** PostgREST `or(...)` clause: any token may match title or body. */
export function communitySearchOrFilter(tokens: string[]): string {
  const parts: string[] = [];
  for (const raw of tokens) {
    const esc = escapeIlike(raw);
    parts.push(`title.ilike.%${esc}%`, `body.ilike.%${esc}%`);
  }
  return parts.join(",");
}

export function communitySearchRelevanceScore(input: {
  title: string | null;
  body: string;
  bodyFormat?: "plain" | "html" | null;
  tokens: string[];
}): number {
  const title = (input.title ?? "").toLowerCase();
  const plainBody =
    input.bodyFormat === "html" ? htmlToPlainText(input.body).toLowerCase() : input.body.toLowerCase();
  let s = 0;
  for (const raw of input.tokens) {
    const t = raw.toLowerCase();
    if (!t) continue;
    if (title.includes(t)) {
      s += title.startsWith(t) ? 4 : 2;
    }
    if (plainBody.includes(t)) s += 1;
  }
  return s;
}
