import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.settings();

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
