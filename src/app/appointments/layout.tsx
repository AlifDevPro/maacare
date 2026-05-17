import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.appointments();

export default function AppointmentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
