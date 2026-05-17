import type { MetadataRoute } from "next";

import { PUBLIC_SITEMAP_PATHS } from "@/lib/seo/metadata";
import { getSiteUrl } from "@/lib/seo/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();

  return PUBLIC_SITEMAP_PATHS.map(({ path, priority, changeFrequency }) => ({
    url: `${siteUrl}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: changeFrequency ?? (path === "/" ? "weekly" : "monthly"),
    priority: priority ?? 0.5,
  }));
}
