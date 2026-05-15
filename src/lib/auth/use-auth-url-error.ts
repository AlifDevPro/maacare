"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type SearchParamsLike = { get: (key: string) => string | null; toString: () => string };

/**
 * Applies ?error= from the URL once, then removes it so i18n re-renders cannot re-show the banner.
 */
export function useAuthUrlError(
  searchParams: SearchParamsLike,
  pathname: string,
  messages: { auth_callback: string; missing_code: string },
  setError: (message: string | null) => void,
) {
  const router = useRouter();
  const handledRef = useRef<string | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    const err = searchParams.get("error");
    if (err !== "auth_callback" && err !== "missing_code") {
      handledRef.current = null;
      return;
    }
    if (handledRef.current === err) return;

    handledRef.current = err;
    const msg = messagesRef.current;
    setError(err === "auth_callback" ? msg.auth_callback : msg.missing_code);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, setError]);
}
