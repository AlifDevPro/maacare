"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";

import { MaaCareLogo } from "@/components/brand/maacare-logo";
import { APP_PRIMARY_NAV_ITEMS, isAppPrimaryNavActive } from "@/lib/app-nav-items";
import { cn } from "@/lib/utils";

export function DesktopAppSidebar() {
  const { t } = useTranslation("nav");
  const pathname = usePathname();

  return (
    <aside
      aria-label={t("primary_nav")}
      className="sticky top-0 hidden h-[100dvh] w-56 shrink-0 flex-col border-r border-border/60 bg-background/95 px-3 py-6 backdrop-blur-xl lg:flex xl:w-64"
    >
      <MaaCareLogo
        href="/app"
        size="lg"
        className="mb-8 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/80"
      />
      <nav className="flex flex-1 flex-col gap-1">
        {APP_PRIMARY_NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => {
          const active = isAppPrimaryNavActive(pathname, to);
          return (
            <Link
              key={to}
              href={to}
              prefetch
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-[transform,colors] duration-150 active:scale-[0.98] motion-reduce:active:scale-100",
                active
                  ? "bg-primary-soft text-primary"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent transition-colors",
                  active && "border-primary/20 bg-muted/50",
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
              </span>
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
