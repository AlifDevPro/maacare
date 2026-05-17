import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.messages();

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
