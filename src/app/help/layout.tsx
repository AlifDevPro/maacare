import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.help();

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
