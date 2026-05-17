import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.forgotPassword();

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
