"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useTransition, type ComponentProps, type MouseEvent } from "react";

import { prefetchProfileBundle } from "@/lib/app/profile-bundle-query";

type InstantLinkProps = ComponentProps<typeof Link> & {
  /** Warm GET /api/profile when navigating to profile routes. */
  warmProfileBundle?: boolean;
  /** Push on click without waiting for the server RSC payload (feels native). */
  instant?: boolean;
};

function isProfilePath(href: string) {
  return href === "/profile" || href.startsWith("/profile/");
}

function hrefToString(href: ComponentProps<typeof Link>["href"]): string {
  if (typeof href === "string") return href;
  if (href && typeof href === "object" && "pathname" in href && href.pathname) {
    return href.pathname;
  }
  return "";
}

export function InstantLink({
  href,
  warmProfileBundle,
  instant = false,
  onPointerEnter,
  onTouchStart,
  onClick,
  prefetch = true,
  ...props
}: InstantLinkProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();
  const hrefStr = hrefToString(href);
  const useInstant = instant || hrefStr === "/profile/edit";

  const warm = useCallback(() => {
    if (prefetch !== false && hrefStr) {
      router.prefetch(hrefStr);
    }
    if (warmProfileBundle ?? isProfilePath(hrefStr)) {
      void prefetchProfileBundle(queryClient);
    }
  }, [hrefStr, prefetch, queryClient, router, warmProfileBundle]);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    warm();
    onClick?.(e);
    if (useInstant && !e.defaultPrevented && hrefStr) {
      e.preventDefault();
      startTransition(() => {
        router.push(hrefStr);
      });
    }
  };

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onPointerEnter={(e) => {
        warm();
        onPointerEnter?.(e);
      }}
      onTouchStart={(e) => {
        warm();
        onTouchStart?.(e);
      }}
      onClick={handleClick}
      {...props}
    />
  );
}
