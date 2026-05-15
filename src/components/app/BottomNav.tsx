"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";

import { useProfileMenuOpen } from "@/components/app/profile-menu-state";
import { APP_PRIMARY_NAV_ITEMS, isAppPrimaryNavActive } from "@/lib/app-nav-items";
import { APP_SHELL_CONTENT_WIDTH } from "@/lib/app-shell-layout";
import { cn } from "@/lib/utils";

export function BottomNav({ className }: { className?: string }) {
  const { t } = useTranslation("nav");
  const pathname = usePathname();
  const { open: profileMenuOpen } = useProfileMenuOpen();

  return (
    <nav
      aria-label={t("primary_nav")}
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur-xl lg:hidden",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className={cn("flex items-stretch justify-between py-1.5", APP_SHELL_CONTENT_WIDTH)}>
        {APP_PRIMARY_NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => {
          const active =
            isAppPrimaryNavActive(pathname, to) || (to === "/profile" && profileMenuOpen);

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
