"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useTransition } from "react";

import { prefetchProfileBundle } from "@/lib/app/profile-bundle-query";

function isProfilePath(href: string) {
  return href === "/profile" || href.startsWith("/profile/");
}

/** Push route immediately in a transition; warm caches before navigation. */
export function useInstantNavigate() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string) => {
      router.prefetch(href);
      if (isProfilePath(href)) {
        void prefetchProfileBundle(queryClient);
      }
      startTransition(() => {
        router.push(href);
      });
    },
    [queryClient, router],
  );

  return { navigate, isPending };
}
