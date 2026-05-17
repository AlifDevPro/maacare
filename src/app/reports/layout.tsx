import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.reports();

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
