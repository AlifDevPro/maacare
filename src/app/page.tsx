import type { Metadata } from "next";

import LandingPageClient from "@/app/landing-page-client";
import { routeMetadata } from "@/lib/seo/route-metadata";

export const metadata: Metadata = routeMetadata.home();

export default function LandingPage() {
  return <LandingPageClient />;
}
