import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS_WITH_IMG = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "span",
  "div",
  "img",
];

const ALLOWED_TAGS_NO_IMG = ALLOWED_TAGS_WITH_IMG.filter((t) => t !== "img");

type SanitizeExclusiveFrame = {
  tag: string;
  attribs: Record<string, string>;
};

/**
 * Sanitize rich community post HTML. Only <img src> under the given public storage prefix are kept.
 * Uses `sanitize-html` (no jsdom) so serverless bundles stay compatible with Vercel.
 */
export function sanitizeCommunityPostHtml(dirty: string, imageUrlPrefix: string): string {
  const prefix = imageUrlPrefix.trim();
  const allowedTags = prefix ? [...ALLOWED_TAGS_WITH_IMG] : [...ALLOWED_TAGS_NO_IMG];

  const opts = {
    allowedTags,
    allowedAttributes: {
      "*": ["class"],
      a: ["href", "target", "rel"],
      ...(prefix ? { img: ["src", "alt", "width", "height", "class"] } : {}),
    },
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
      ...(prefix ? { img: ["http", "https"] } : {}),
    },
    exclusiveFilter(frame: SanitizeExclusiveFrame): boolean | "excludeTag" {
      if (frame.tag !== "img" || !prefix) return false;
      const src = String(frame.attribs.src ?? "").trim();
      if (!src.startsWith(prefix)) return "excludeTag";
      return false;
    },
  };

  const out = sanitizeHtml(dirty, opts);

  if (!prefix) return out;

  return out.replace(/<img\b[^>]*>/gi, (tag) => {
    const m = tag.match(/\bsrc=["']([^"']+)["']/i);
    const src = m?.[1]?.trim() ?? "";
    if (!src.startsWith(prefix)) return "";
    if (!tag.includes("loading=")) {
      return tag.replace(/<img\b/i, '<img loading="lazy" referrerpolicy="no-referrer" ');
    }
    return tag;
  });
}

export function communityPostImagePublicPrefix(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/community-post-images/`;
}
