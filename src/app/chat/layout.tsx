import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.chat();

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
