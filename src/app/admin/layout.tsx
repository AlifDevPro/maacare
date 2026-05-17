import type { Metadata } from "next";
import type { ReactNode } from "react";

import { routeMetadata } from "@/lib/seo/route-metadata";

import { AdminShell } from "./_admin-shell";

export const metadata: Metadata = routeMetadata.admin();

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
