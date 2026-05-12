import type { Metadata } from "next";

import { DocsChrome } from "@/components/docs/docs-chrome";

export const metadata: Metadata = {
  title: "Documentation — MaaCare",
  description: "MaaCare product documentation: features, user guide, HTTP APIs, algorithms, and architecture.",
  robots: { index: false, follow: true },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsChrome>{children}</DocsChrome>;
}
