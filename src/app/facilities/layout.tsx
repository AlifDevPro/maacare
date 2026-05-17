import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.facilities();

export default function FacilitiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
