/** Push notification icons — square assets with safe padding; absolute HTTPS for iOS/FCM. */

import { BRAND_ASSETS, absoluteUrl, getSiteUrl } from "@/lib/seo/site-config";

export function getSiteOrigin(): string | null {
  try {
    return getSiteUrl();
  } catch {
    return null;
  }
}

export { absoluteUrl as absoluteAssetUrl };

/** Large icon in notification tray (square, centered mark). */
export function getPushNotificationIconUrl(): string {
  return absoluteUrl(BRAND_ASSETS.notificationIcon);
}

/** Small monochrome badge (Android status bar / some browsers). */
export function getPushNotificationBadgeUrl(): string {
  return absoluteUrl(BRAND_ASSETS.notificationBadge);
}

/** Optional rich notification image. */
export function getPushNotificationImageUrl(): string {
  return absoluteUrl(BRAND_ASSETS.logoMark512);
}

export const PUSH_ICON_PATHS = {
  notificationIcon: BRAND_ASSETS.notificationIcon,
  notificationBadge: BRAND_ASSETS.notificationBadge,
  icon192: BRAND_ASSETS.logoMark,
  icon512: BRAND_ASSETS.logoMark512,
} as const;
