"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MaaCareLogo } from "@/components/brand/maacare-logo";
import { DocsMobileNav, DocsSidebar } from "@/components/docs/docs-nav";

export function DocsChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/docs";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <DocsMobileNav pathname={pathname} />
            <Link href="/docs" className="flex min-w-0 items-center gap-2 truncate">
              <MaaCareLogo size="md" showWordmark={false} />
              <span className="truncate font-display text-lg font-semibold tracking-tight text-foreground">
                MaaCare <span className="text-muted-foreground">Docs</span>
              </span>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-95"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 pb-20 pt-6 lg:pt-8">
        <DocsSidebar pathname={pathname} />
        <main className="min-w-0 flex-1 max-w-4xl">
          <div className="rounded-3xl border border-border/60 bg-card/35 p-6 shadow-[0_1px_0_rgba(0,0,0,0.04)_inset] backdrop-blur-sm md:p-8 lg:p-10 dark:bg-card/25 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
