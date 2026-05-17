import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.postpartum();

export default function PostpartumLayout({ children }: { children: React.ReactNode }) {
  return children;
}
