import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.notifications();

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
