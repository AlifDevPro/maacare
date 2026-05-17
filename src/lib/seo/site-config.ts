/** Central brand + site URLs for metadata, PWA, and push assets. */

export const SITE_NAME = "MaaCare";
export const SITE_TAGLINE = "AI Maternal Health Companion";
export const SITE_TITLE_DEFAULT = `${SITE_NAME} — ${SITE_TAGLINE}`;

export const SITE_DESCRIPTION =
  "Personalized pregnancy guidance, symptom checks, community support, and 24/7 AI help for expecting and new mothers in English and Bangla.";

export const SITE_KEYWORDS = [
  "maternal health",
  "pregnancy app",
  "postpartum support",
  "AI health assistant",
  "symptom checker pregnancy",
  "Bangladesh maternal care",
  "বাংলা গর্ভাবস্থা",
  "MaaCare",
] as const;

export const TWITTER_HANDLE = "@MaaCare";

/** Primary logo — your PNG at public/icons/logo.png (no generated background). */
export const BRAND_LOGO_PATH = "/icons/logo.png";

export const BRAND_ASSETS = {
  logo: BRAND_LOGO_PATH,
  logoMark: BRAND_LOGO_PATH,
  logoMark512: "/icons/maacare-512.png",
  appleTouch: "/icons/apple-touch-icon.png",
  notificationIcon: BRAND_LOGO_PATH,
  notificationBadge: BRAND_LOGO_PATH,
  ogImage: "/icons/og-image.png",
} as const;

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, "");
  if (raw && (raw.startsWith("http://") || raw.startsWith("https://"))) {
    return raw;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
