import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.emergency();

export default function EmergencyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
