"use client";

import type { ReactNode } from "react";

import { MaaCareLogo } from "@/components/brand/maacare-logo";
import { GlobalLanguageSwitcher } from "@/components/app/global-language-switcher";
import { Card } from "@/components/ui/card";
import { FORM_FOCUS_SAFE } from "@/lib/form-control-focus";
import { cn } from "@/lib/utils";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  leadingAction,
  cardClassName,
  compactTitle,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  leadingAction?: ReactNode;
  cardClassName?: string;
  /** Smaller card title for multi-step flows (signup wizard). */
  compactTitle?: boolean;
}) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-gradient-hero">
      <header className="flex min-w-0 items-center justify-between gap-2 px-4 py-5">
        <MaaCareLogo href="/" size="lg" className="min-w-0" />
        <GlobalLanguageSwitcher align="end" />
      </header>
      <main className="flex w-full min-w-0 max-w-full flex-1 items-center justify-center px-3 py-6 sm:px-4 sm:py-8">
        <Card
          className={cn(
            "w-full min-w-0 max-w-full border-0 bg-card/95 p-4 shadow-none backdrop-blur-sm sm:max-w-md sm:rounded-xl sm:border sm:border-border sm:p-7 sm:shadow-card",
            cardClassName,
          )}
        >
          <div className="flex items-start gap-3">
            {leadingAction}
            <div className="min-w-0 flex-1">
              <h1
                className={cn(
                  "font-display font-semibold tracking-tight text-foreground",
                  compactTitle ? "text-lg sm:text-xl" : "text-2xl",
                )}
              >
                {title}
              </h1>
              {subtitle ? (
                <p className={cn("text-muted-foreground", compactTitle ? "mt-1 text-xs" : "mt-1.5 text-sm")}>
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <div className={cn("mt-6 min-w-0", FORM_FOCUS_SAFE)}>{children}</div>
          {footer ? (
            <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>
          ) : null}
        </Card>
      </main>
    </div>
  );
}
