"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { prefetchProfileBundle } from "@/lib/app/profile-bundle-query";
import { useSession } from "@/lib/auth-client";

/** In-app routes opened from shell — prefetch RSC + warm API caches on idle. */
const SHELL_PREFETCH_ROUTES = [
  "/app",
  "/chat",
  "/symptoms",
  "/symptoms/result",
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
  "/messages",
  "/facilities",
  "/appointments",
  "/reports",
] as const;

function shouldSkipPrefetch(pathname: string, href: string): boolean {
  if (href === pathname) return true;
  if (href === "/app") return false;
  if (pathname.startsWith(href + "/")) return true;
  return false;
}

export function ShellPrefetch() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user } = useSession();

  useEffect(() => {
    const warm = () => {
      for (const href of SHELL_PREFETCH_ROUTES) {
        if (!shouldSkipPrefetch(pathname, href)) {
          router.prefetch(href);
        }
      }
      if (user) {
        void prefetchProfileBundle(queryClient);
      }
    };

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(warm, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(warm, 120);
    return () => window.clearTimeout(t);
  }, [pathname, queryClient, router, user]);

  return null;
}
