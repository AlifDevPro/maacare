import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApiReferencePage } from "@/components/docs/api-reference-page";
import { FeaturesCatalogTable } from "@/components/docs/features-catalog-table";
import { MarkdownDoc } from "@/components/docs/markdown-doc";
import { VisualGuidesPage } from "@/components/docs/visual-guides-page";
import { loadDocsMarkdown } from "@/lib/docs/load-doc";
import {
  docsMarkdownFileForSlug,
  isApiDocsSlug,
  isMarkdownDocsSlug,
  isVisualGuidesSlug,
  parseApiDocsSlug,
  type DocsMarkdownSlug,
} from "@/lib/docs/nav";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

function titleForSlug(slug: string[] | undefined): string {
  if (!slug?.length) return "Overview";
  const api = parseApiDocsSlug(slug);
  if (api !== null) {
    if (api === "all") return "API reference";
    const labels: Record<string, string> = {
      auth: "API — Auth",
      core: "API — Core data",
      ai: "API — AI & reports",
      community: "API — Community",
      notifications: "API — Notifications",
      admin: "API — Admin",
      misc: "API — Misc",
    };
    return labels[api] ?? "API reference";
  }
  const one = slug[0];
  const map: Record<string, string> = {
    "getting-started": "Getting started",
    features: "Features",
    "user-guide": "User guide",
    algorithms: "Algorithms",
    architecture: "Architecture",
    "visual-guides": "Visual guides",
  };
  return map[one ?? ""] ?? "Documentation";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (isApiDocsSlug(slug) && parseApiDocsSlug(slug) === null) {
    return { title: "Not found — MaaCare Documentation", robots: { index: false, follow: true } };
  }
  if (
    slug?.length &&
    !isApiDocsSlug(slug) &&
    !isMarkdownDocsSlug(slug) &&
    !isVisualGuidesSlug(slug) &&
    slug.length > 0
  ) {
    return { title: "Not found — MaaCare Documentation", robots: { index: false, follow: true } };
  }
  return {
    title: `${titleForSlug(slug)} — MaaCare Documentation`,
    description: "Product, API, and platform documentation for MaaCare.",
    robots: { index: false, follow: true },
  };
}

export default async function DocsSlugPage({ params }: PageProps) {
  const { slug } = await params;

  const apiView = parseApiDocsSlug(slug);
  if (isApiDocsSlug(slug)) {
    if (apiView === null) notFound();
    return <ApiReferencePage group={apiView} />;
  }

  if (!slug?.length) {
    const content = await loadDocsMarkdown("index.md");
    return <MarkdownDoc content={content} />;
  }

  if (isVisualGuidesSlug(slug)) {
    return <VisualGuidesPage />;
  }

  if (isMarkdownDocsSlug(slug)) {
    const key = slug[0] as DocsMarkdownSlug;
    const content = await loadDocsMarkdown(docsMarkdownFileForSlug(key));
    if (key === "features") {
      return (
        <div className="space-y-12">
          <MarkdownDoc content={content} />
          <FeaturesCatalogTable />
        </div>
      );
    }
    return <MarkdownDoc content={content} />;
  }

  notFound();
}
