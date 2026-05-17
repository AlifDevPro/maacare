import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.appHome();

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
