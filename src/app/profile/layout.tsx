import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.profile();

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
