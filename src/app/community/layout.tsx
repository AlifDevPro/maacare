import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.community();

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
