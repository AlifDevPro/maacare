import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.login();

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
