/**
 * Strip tags and decode a small set of HTML entities for safe one-line previews (server-safe).
 */
export function htmlToPlainText(html: string): string {
  const stripped = html.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(stripped).replace(/\s+/g, " ").trim();
}

export function trimPlainPreview(plain: string, max = 160): string {
  const t = plain.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const cut = slice.replace(/\s+\S*$/, "");
  return `${cut || slice}…`;
}

function decodeHtmlEntities(input: string): string {
  let s = input.replace(/&#x([0-9a-f]{1,6});?/gi, (full, hex: string) => {
    const code = Number.parseInt(hex, 16);
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return full;
    try {
      return String.fromCodePoint(code);
    } catch {
      return full;
    }
  });
  s = s.replace(/&#(\d{1,7});?/g, (full, d: string) => {
    const code = Number.parseInt(d, 10);
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return full;
    try {
      return String.fromCodePoint(code);
    } catch {
      return full;
    }
  });
  const named: Record<string, string> = {
    nbsp: " ",
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    ldquo: "\u201c",
    rdquo: "\u201d",
    lsquo: "\u2018",
    rsquo: "\u2019",
    hellip: "\u2026",
    mdash: "\u2014",
    ndash: "\u2013",
  };
  return s.replace(/&([a-z]+);/gi, (m, name: string) => named[name.toLowerCase()] ?? m);
}
