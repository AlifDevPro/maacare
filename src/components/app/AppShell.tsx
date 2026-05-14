"use client";

import type { ReactNode } from "react";

import { BottomNav } from "./BottomNav";
import { DesktopAppSidebar } from "./desktop-app-sidebar";
import { ShellPrefetch } from "./shell-prefetch";
import { APP_SHELL_CONTENT_WIDTH } from "@/lib/app-shell-layout";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  hideNav?: boolean;
  className?: string;
}

export function AppShell({ children, hideNav, className }: AppShellProps) {
  return (
    <div className="relative z-10 min-h-screen bg-background lg:flex lg:min-h-screen">
      {!hideNav ? <DesktopAppSidebar /> : null}
      <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col bg-background">
        <main
          className={cn(
            APP_SHELL_CONTENT_WIDTH,
            "min-w-0 flex-1 pb-24 lg:pb-8",
            hideNav && "pb-6 lg:pb-6",
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
      </div>
    </div>
  );
}
