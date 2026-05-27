import { unstable_cache } from "next/cache";

import { getDocsRuntimeSnapshot, DOCS_SEARCH_CACHE_TAG } from "./snapshot";

export type DocsSearchRecord = {
  slug: string;
  title: string;
  summary: string;
  bodyText: string;
  anchors: string[];
};

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function buildSearchIndexInner(): Promise<DocsSearchRecord[]> {
  const snapshot = await getDocsRuntimeSnapshot({ bypassCache: true });
  return snapshot.sections.map((section) => {
    const anchors = Array.isArray(section.metadata?.anchors)
      ? section.metadata.anchors.filter((x): x is string => typeof x === "string")
      : [section.slug];
    return {
      slug: section.slug,
      title: section.title,
      summary: section.summary,
      bodyText: stripHtml(section.body_html || section.body_md || ""),
      anchors,
    };
  });
}

const buildSearchIndexCached = unstable_cache(buildSearchIndexInner, ["docs-search-index-v1"], {
  revalidate: 120,
  tags: [DOCS_SEARCH_CACHE_TAG],
});

export async function getDocsSearchIndex() {
  return buildSearchIndexCached();
}

