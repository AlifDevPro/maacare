import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.resetPassword();

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
