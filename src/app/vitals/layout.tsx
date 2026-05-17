import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.vitals();

export default function VitalsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
