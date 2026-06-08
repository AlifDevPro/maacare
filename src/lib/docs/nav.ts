import type { ApiDocGroup } from "@/lib/docs/types";

export type DocsNavItem = {
  title: string;
  href: string;
  children?: { title: string; href: string }[];
};

export const DOCS_NAV: DocsNavItem[] = [
  { title: "Overview", href: "/docs" },
  { title: "Getting started", href: "/docs/getting-started" },
  { title: "Features", href: "/docs/features" },
  { title: "User guide", href: "/docs/user-guide" },
  { title: "Visual guides", href: "/docs/visual-guides" },
  {
    title: "API reference",
    href: "/docs/api",
    children: [
      { title: "Overview", href: "/docs/api" },
      { title: "Auth", href: "/docs/api/auth" },
      { title: "Core data", href: "/docs/api/core" },
      { title: "AI & reports", href: "/docs/api/ai" },
      { title: "Community", href: "/docs/api/community" },
      { title: "Notifications", href: "/docs/api/notifications" },
      { title: "Admin", href: "/docs/api/admin" },
      { title: "Misc", href: "/docs/api/misc" },
    ],
  },
  { title: "Algorithms", href: "/docs/algorithms" },
  { title: "Architecture", href: "/docs/architecture" },
  {
    title: "Platform guide",
    href: "/docs/platform-overview",
    children: [
      { title: "Overview", href: "/docs/platform-overview" },
      { title: "User flows", href: "/docs/platform-flows" },
      { title: "System design", href: "/docs/platform-system" },
      { title: "AI capabilities", href: "/docs/platform-ai" },
      { title: "Security & privacy", href: "/docs/platform-security" },
      { title: "Deployment", href: "/docs/platform-deploy" },
    ],
  },
  {
    title: "Live docs (CMS)",
    href: "/docs/live",
    children: [
      { title: "All live sections", href: "/docs/live" },
      { title: "Problem Definition", href: "/docs/live/problem" },
      { title: "Solution Overview", href: "/docs/live/solution" },
      { title: "AI Layer", href: "/docs/live/ai-layer" },
      { title: "Team", href: "/docs/live/team" },
      { title: "Changelog", href: "/docs/live/changelog" },
    ],
  },
];

/** Slugs (path segments after /docs) that map to markdown files in `src/content/docs`. */
export const DOCS_MARKDOWN_SLUGS = [
  "getting-started",
  "features",
  "user-guide",
  "algorithms",
  "architecture",
  "platform-overview",
  "platform-flows",
  "platform-system",
  "platform-ai",
  "platform-security",
  "platform-deploy",
] as const;

export type DocsMarkdownSlug = (typeof DOCS_MARKDOWN_SLUGS)[number];

export function isVisualGuidesSlug(segments: string[] | undefined): boolean {
  return Array.isArray(segments) && segments.length === 1 && segments[0] === "visual-guides";
}

export function isMarkdownDocsSlug(segments: string[] | undefined): segments is [DocsMarkdownSlug] {
  return (
    Array.isArray(segments) &&
    segments.length === 1 &&
    (DOCS_MARKDOWN_SLUGS as readonly string[]).includes(segments[0]!)
  );
}

export function isApiDocsSlug(segments: string[] | undefined): boolean {
  return Array.isArray(segments) && segments.length >= 1 && segments[0] === "api";
}

export type ApiDocsView = "all" | ApiDocGroup;

export function parseApiDocsSlug(segments: string[] | undefined): ApiDocsView | null {
  if (!isApiDocsSlug(segments) || !segments) return null;
  if (segments.length === 1) return "all";
  const g = segments[1];
  const allowed: ApiDocGroup[] = ["auth", "core", "ai", "community", "notifications", "admin", "misc"];
  if (g && (allowed as string[]).includes(g)) return g as ApiDocGroup;
  return null;
}

export function docsMarkdownFileForSlug(slug: DocsMarkdownSlug): string {
  return `${slug}.md`;
}
