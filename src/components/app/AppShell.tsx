"use client";

import type { ReactNode } from "react";

import { AppShellColumn, AppShellColumnProvider } from "./app-shell-column";
import { BottomNav } from "./BottomNav";
import { ProfileMenuProvider } from "./profile-menu-state";
import { ShellPrefetch } from "./shell-prefetch";
import { PwaManager } from "./pwa-manager";
import { WebPushManager } from "./web-push-manager";
import { APP_SHELL_CONTENT_PADDING } from "@/lib/app-shell-layout";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  hideNav?: boolean;
  /** Full viewport width (e.g. chat with persistent sidebar). */
  wide?: boolean;
  className?: string;
}

export function AppShell({ children, hideNav, wide, className }: AppShellProps) {
  return (
    <ProfileMenuProvider>
      <AppShellColumnProvider>
        <div className="relative z-10 min-h-screen bg-background">
          <AppShellColumn wide={wide}>
            <WebPushManager />
            <PwaManager />
            <main
              className={cn(
                wide
                  ? cn(
                      "flex min-h-0 flex-col px-0",
                      hideNav ? "h-[100dvh]" : "h-[calc(100dvh-5.5rem)]",
                    )
                  : APP_SHELL_CONTENT_PADDING,
                "min-w-0 flex-1",
                wide ? "pb-0" : "pb-24",
                hideNav && !wide && "pb-0",
                className,
              )}
            >
              {children}
            </main>
            {!hideNav ? (
              <>
                <ShellPrefetch />
                <BottomNav />
              </>
            ) : null}
          </AppShellColumn>
        </div>
      </AppShellColumnProvider>
    </ProfileMenuProvider>
  );
}
