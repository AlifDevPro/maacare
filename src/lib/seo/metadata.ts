import type { Metadata } from "next";

import {
  BRAND_ASSETS,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE_DEFAULT,
  TWITTER_HANDLE,
  absoluteUrl,
  getSiteUrl,
} from "@/lib/seo/site-config";

export type PageMetadataInput = {
  title: string;
  description?: string;
  path?: string;
  /** When true, omit from sitemap and set noindex (auth, admin tools). */
  noIndex?: boolean;
  /** Override default OG image path. */
  ogImage?: string;
};

function ogImageUrl(path: string = BRAND_ASSETS.ogImage): string {
  return absoluteUrl(path);
}

/** Default metadata for root layout (title template, OG, Twitter, icons). */
export function createRootMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const ogImage = ogImageUrl();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: SITE_TITLE_DEFAULT,
      template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    authors: [{ name: SITE_NAME, url: siteUrl }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    keywords: [...SITE_KEYWORDS],
    category: "health",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    alternates: {
      canonical: siteUrl,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      alternateLocale: ["bn_BD"],
      url: siteUrl,
      siteName: SITE_NAME,
      title: SITE_TITLE_DEFAULT,
      description: SITE_DESCRIPTION,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — ${SITE_DESCRIPTION.slice(0, 80)}…`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
      title: SITE_TITLE_DEFAULT,
      description: SITE_DESCRIPTION,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: BRAND_ASSETS.logoMark, sizes: "192x192", type: "image/png" },
        { url: BRAND_ASSETS.logoMark512, sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: BRAND_ASSETS.appleTouch, sizes: "180x180", type: "image/png" }],
      shortcut: BRAND_ASSETS.logoMark,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: SITE_NAME,
    },
    ...(process.env.NEXT_PUBLIC_FB_APP_ID
      ? { other: { "fb:app_id": process.env.NEXT_PUBLIC_FB_APP_ID } }
      : {}),
  };
}

/** Per-route metadata; merges with root title template. */
export function createPageMetadata(input: PageMetadataInput): Metadata {
  const description = input.description ?? SITE_DESCRIPTION;
  const canonical = input.path ? absoluteUrl(input.path) : undefined;
  const ogImage = ogImageUrl(input.ogImage);
  const fullTitle = input.title.includes(SITE_NAME)
    ? input.title
    : `${input.title} · ${SITE_NAME}`;

  return {
    title: input.title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      images: [{ url: ogImage, width: 1200, height: 630, alt: fullTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage],
    },
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

/** Public routes for sitemap.xml */
export const PUBLIC_SITEMAP_PATHS: Array<{
  path: string;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}> = [
  { path: "/", priority: 1 },
  { path: "/login", priority: 0.5 },
  { path: "/signup", priority: 0.8 },
  { path: "/help", priority: 0.6 },
  { path: "/emergency", priority: 0.7 },
  { path: "/facilities", priority: 0.6 },
  { path: "/docs", priority: 0.5 },
];
