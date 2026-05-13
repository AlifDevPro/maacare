"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Home, MessageCircle, Stethoscope, Phone, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { to: "/app", labelKey: "home", icon: Home },
  { to: "/chat", labelKey: "chat", icon: MessageCircle },
  { to: "/symptoms", labelKey: "symptoms", icon: Stethoscope },
  { to: "/emergency", labelKey: "emergency", icon: Phone },
  { to: "/community", labelKey: "community", icon: Users },
] as const;

export function BottomNav() {
  const { t } = useTranslation("nav");
  const pathname = usePathname();
  const router = useRouter();

  const prefetchTargets = useMemo(() => items.map((i) => i.to), []);

  useEffect(() => {
    for (const to of prefetchTargets) {
      if (to !== pathname) {
        router.prefetch(to);
      }
    }
  }, [pathname, router, prefetchTargets]);

  return (
    <nav
      aria-label={t("primary_nav")}
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
        {items.map(({ to, labelKey, icon: Icon }) => {
          const active = to === "/app" ? pathname === "/app" : pathname.startsWith(to);

          return (
            <li key={to} className="flex-1">
              <Link
                href={to}
                prefetch
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium touch-manipulation transition-[transform,colors] duration-150 active:scale-[0.96] motion-reduce:active:scale-100",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full transition-[transform,colors,box-shadow] duration-150 ease-out group-active:[&>svg]:scale-110 motion-reduce:group-active:[&>svg]:scale-100",
                    active && "bg-primary-soft shadow-soft",
                  )}
                >
                  <Icon
                    className="h-[18px] w-[18px] transition-transform duration-150 ease-out"
                    strokeWidth={active ? 2.4 : 2}
                  />
                </span>
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
