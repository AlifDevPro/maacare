"use client";

import type { ReactNode } from "react";

import { AppShellColumn, AppShellColumnProvider } from "./app-shell-column";
import { BottomNav } from "./BottomNav";
import { ProfileMenuProvider } from "./profile-menu-state";
import { ShellPrefetch } from "./shell-prefetch";
import { WebPushManager } from "./web-push-manager";
import { APP_SHELL_CONTENT_PADDING } from "@/lib/app-shell-layout";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  hideNav?: boolean;
  className?: string;
}

export function AppShell({ children, hideNav, className }: AppShellProps) {
  return (
    <ProfileMenuProvider>
      <AppShellColumnProvider>
        <div className="relative z-10 min-h-screen bg-background">
          <AppShellColumn>
            <WebPushManager />
            <main
              className={cn(
                APP_SHELL_CONTENT_PADDING,
                "min-w-0 flex-1 pb-24",
                hideNav && "pb-6",
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
