import type { Metadata } from "next";

import { DocsChrome } from "@/components/docs/docs-chrome";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Documentation",
    description:
      "MaaCare product documentation: features, user guide, HTTP APIs, algorithms, and architecture.",
    path: "/docs",
  }),
  robots: { index: true, follow: true },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsChrome>{children}</DocsChrome>;
}
