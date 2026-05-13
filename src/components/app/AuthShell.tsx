"use client";

import Link from "next/link";

import type { ReactNode } from "react";

import { GlobalLanguageSwitcher } from "@/components/app/global-language-switcher";
import { Card } from "@/components/ui/card";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-gradient-hero">
      <header className="flex min-w-0 items-center justify-between gap-2 px-4 py-5">
        <Link href="/" className="inline-flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-rose shadow-soft">
            🤍
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">MaaCare</span>
        </Link>
        <GlobalLanguageSwitcher align="end" />
      </header>
      <main className="flex w-full min-w-0 max-w-full flex-1 items-center justify-center px-3 py-6 sm:px-4 sm:py-8">
        <Card className="w-full min-w-0 max-w-full overflow-x-hidden border-0 bg-card/95 p-4 shadow-none backdrop-blur-sm sm:max-w-md sm:rounded-xl sm:border sm:border-border sm:p-7 sm:shadow-card">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6 min-w-0">{children}</div>
          {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
        </Card>
      </main>
    </div>
  );
}
