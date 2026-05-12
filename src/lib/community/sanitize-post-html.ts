import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
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

const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "class", "width", "height"];

/**
 * Sanitize rich community post HTML. Only <img src> under the given public storage prefix are kept.
 */
export function sanitizeCommunityPostHtml(dirty: string, imageUrlPrefix: string): string {
  const prefix = imageUrlPrefix.trim();
  const tags = prefix ? ALLOWED_TAGS : ALLOWED_TAGS.filter((t) => t !== "img");
  const attrs = prefix ? ALLOWED_ATTR : ALLOWED_ATTR.filter((a) => a !== "src");

  let out = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR: attrs,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });

  if (!prefix) return out;

  return out.replace(/<img\b[^>]*>/gi, (tag) => {
    const m = tag.match(/\bsrc=["']([^"']+)["']/i);
    const src = m?.[1]?.trim() ?? "";
    if (!src.startsWith(prefix)) return "";
    if (!tag.includes('loading=')) {
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
