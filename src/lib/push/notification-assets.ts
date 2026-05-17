/** Push notification icons — must be absolute HTTPS URLs for iOS and FCM. */

const ICON_192 = "/icons/maacare-192.png";
const ICON_512 = "/icons/maacare-512.png";

export function getSiteOrigin(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, "");
  return base && (base.startsWith("http://") || base.startsWith("https://")) ? base : null;
}

export function absoluteAssetUrl(path: string): string {
  const origin = getSiteOrigin();
  if (!origin) return path;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getPushNotificationIconUrl(): string {
  return absoluteAssetUrl(ICON_192);
}

export function getPushNotificationBadgeUrl(): string {
  return absoluteAssetUrl(ICON_192);
}

export function getPushNotificationImageUrl(): string {
  return absoluteAssetUrl(ICON_512);
}

export const PUSH_ICON_PATHS = {
  icon192: ICON_192,
  icon512: ICON_512,
} as const;
