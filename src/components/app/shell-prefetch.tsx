"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** In-app routes commonly opened from shell pages — prefetch for snappier transitions. */
const SHELL_PREFETCH_ROUTES = [
  "/app",
  "/chat",
  "/symptoms",
  "/emergency",
  "/community",
  "/planner",
  "/vitals",
  "/postpartum",
  "/profile",
  "/profile/edit",
  "/settings",
  "/help",
  "/notifications",
] as const;

export function ShellPrefetch() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    for (const href of SHELL_PREFETCH_ROUTES) {
      if (href === pathname || (href !== "/app" && pathname.startsWith(href))) continue;
      router.prefetch(href);
    }
  }, [pathname, router]);

  return null;
}
