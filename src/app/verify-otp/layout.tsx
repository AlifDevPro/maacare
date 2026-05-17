import type { Metadata } from "next";

import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.verifyOtp();

export default function VerifyOtpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
