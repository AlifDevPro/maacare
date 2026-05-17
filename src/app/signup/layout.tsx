import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.signup();

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
