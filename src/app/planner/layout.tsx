import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.planner();

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
