import type { Metadata } from "next";

import { ApiReferencePage } from "@/components/docs/api-reference-page";
import { DocsRuntimeRenderer } from "@/components/docs/docs-runtime-renderer";
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
import { getDocsLiveMetrics } from "@/lib/docs-runtime/live-matrix";
import { getDocsRuntimeSnapshot } from "@/lib/docs-runtime/snapshot";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

function titleForSlug(slug: string[] | undefined): string {
  if (!slug?.length) return "Overview";
  if (slug[0] === "live") {
    if (slug.length === 1) return "Live docs";
    return `Live docs — ${decodeURIComponent(slug[1] ?? "section")}`;
  }
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
    "platform-overview": "Platform overview",
    "platform-flows": "User flows",
    "platform-system": "System design",
    "platform-ai": "AI capabilities",
    "platform-security": "Security & privacy",
    "platform-deploy": "Deployment",
  };
  return map[one ?? ""] ?? "Documentation";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${titleForSlug(slug)} — MaaCare Documentation`,
    description: "Product, API, and platform documentation for MaaCare.",
    robots: { index: true, follow: true },
  };
}

export default async function DocsSlugPage({ params }: PageProps) {
  const { slug } = await params;

  const apiView = parseApiDocsSlug(slug);
  if (isApiDocsSlug(slug)) {
    if (apiView === null) return <MarkdownDoc content={"# Not found\n\nAPI group not found."} />;
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

  if (slug[0] === "live") {
    const [snapshot, metrics] = await Promise.all([getDocsRuntimeSnapshot(), getDocsLiveMetrics()]);
    const sectionSlug = slug[1] ? decodeURIComponent(slug[1]) : null;
    const filtered =
      sectionSlug && sectionSlug !== "all"
        ? {
            ...snapshot,
            sections: snapshot.sections.filter((section) => section.slug === sectionSlug),
          }
        : snapshot;
    return <DocsRuntimeRenderer snapshot={filtered} metrics={metrics} />;
  }

  return (
    <MarkdownDoc content={"# Not found\n\nThis documentation page was not found. Try the menu on the left."} />
  );
}
